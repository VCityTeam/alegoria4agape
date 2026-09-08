/**
 * Material for the BDTopo buildings: flat shading so the geometry reads as
 * volumes, plus optional projective texture mapping of a registered
 * historical photograph.
 *
 * The photograph is projected from the camera pose MicMac computed for it.
 * This replaces the OrientedImageMaterial / PhotogrammetricCamera pair of the
 * itowns-photogrammetric-camera fork: upstream iTowns keeps its own
 * OrientedImageMaterial internal, so the shader lives here instead and only
 * uses THREE, which iTowns re-exports.
 *
 * Conventions
 *  - The projector is a THREE.PerspectiveCamera holding the MicMac pose, so it
 *    looks down its own -Z with +Y up. MicMac image coordinates are y-down,
 *    which the shader flips when it builds the pixel coordinates.
 *  - The calibration is the one parsed from the MicMac Calib-*.xml file:
 *    focal and principal point in pixels, plus the radial ModRad polynomial.
 *    That polynomial maps ideal pixels to distorted ones, which is the right
 *    direction here: we sample the raw, still-distorted photograph.
 *  - iTowns' Feature2Mesh writes no normal attribute, so the shading normal is
 *    taken from the screen-space derivatives of the world position. That gives
 *    one normal per triangle, which is what these extruded blocks want.
 */
(function () {
    'use strict';

    var VERTEX_SHADER = [
        // iTowns renders with a logarithmic depth buffer, so this material has to
        // write the same depth as the built-in ones; without these chunks its
        // fragments lose every depth test and the geometry disappears.
        '#include <common>',
        '#include <logdepthbuf_pars_vertex>',
        'uniform vec3 projectorPosition;',
        'varying vec3 vRelativePosition;',
        '',
        'void main() {',
        '    // Subtracting the projector position from the model matrix translation,',
        '    // rather than from the world position afterwards, keeps the float32',
        '    // precision usable at globe scale (positions are ~6.4e6 metres).',
        '    mat4 relativeModelMatrix = modelMatrix;',
        '    relativeModelMatrix[3].xyz -= projectorPosition;',
        '    vRelativePosition = (relativeModelMatrix * vec4(position, 1.0)).xyz;',
        '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '    #include <logdepthbuf_vertex>',
        '}'
    ].join('\n');

    var FRAGMENT_SHADER = [
        '#include <common>',
        '#include <logdepthbuf_pars_fragment>',
        'uniform sampler2D map;',
        'uniform float photoEnabled;',
        'uniform mat4 projectorRotationInverse;',
        'uniform float focal;',
        'uniform vec2 principalPoint;',
        'uniform vec2 imageSize;',
        'uniform vec2 distortionCenter;',
        'uniform vec3 distortionCoefficients;',
        'uniform float distortionLimitSquared;',
        'uniform vec3 baseColor;',
        'uniform float projectionOpacity;',
        'uniform float borderSharpness;',
        'uniform float borderFade;',
        'uniform vec3 lightDirection;',
        'uniform float shadingStrength;',
        'varying vec3 vRelativePosition;',
        '',
        'vec3 linearToSRGB(vec3 color) {',
        '    vec3 low = color * 12.92;',
        '    vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(0.41666)) - 0.055;',
        '    return mix(low, high, step(vec3(0.0031308), color));',
        '}',
        '',
        '// Flat per-triangle shading. Feature2Mesh writes no normals, so the normal',
        '// comes from the derivatives of the interpolated world position.',
        'float faceShading() {',
        '    vec3 faceNormal = cross(dFdx(vRelativePosition), dFdy(vRelativePosition));',
        '    float len = length(faceNormal);',
        '    if (len <= 0.0) {',
        '        return 1.0;',
        '    }',
        '    // abs(): the buildings are drawn double sided and their winding is not',
        '    // guaranteed, so light both facings the same way.',
        '    float lambert = abs(dot(faceNormal / len, lightDirection));',
        '    return 1.0 - shadingStrength * (1.0 - lambert);',
        '}',
        '',
        'void main() {',
        '    #include <logdepthbuf_fragment>',
        '    vec3 color = baseColor;',
        '    vec3 cameraSpace = (projectorRotationInverse * vec4(vRelativePosition, 1.0)).xyz;',
        '    float depth = -cameraSpace.z;',
        '',
        '    // photoEnabled is 0 when no photograph is loaded: the material is then',
        '    // just the shaded base colour.',
        '    if (photoEnabled > 0.5 && depth > 0.0) {',
        '        vec2 pixel = vec2(',
        '            principalPoint.x + focal * cameraSpace.x / depth,',
        '            principalPoint.y - focal * cameraSpace.y / depth);',
        '',
        '        vec2 radial = pixel - distortionCenter;',
        '        float r2 = dot(radial, radial);',
        '        if (r2 <= distortionLimitSquared) {',
        '            float polynom = dot(distortionCoefficients, vec3(r2, r2 * r2, r2 * r2 * r2));',
        '            pixel += polynom * radial;',
        '',
        '            // The texture is uploaded with flipY, so the top image row is v = 1.',
        '            vec2 uv = vec2(pixel.x / imageSize.x, 1.0 - pixel.y / imageSize.y);',
        '            if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {',
        '                vec4 photo = texture2D(map, uv);',
        '                vec2 border = min(uv, 1.0 - uv);',
        '                // borderFade 1: soften the image edges. 0: the whole image is',
        '                // applied at exactly projectionOpacity, with a hard edge.',
        '                float edge = clamp(borderSharpness * min(border.x, border.y), 0.0, 1.0);',
        '                float fade = mix(1.0, edge, borderFade);',
        '                color = mix(color, photo.rgb, photo.a * projectionOpacity * fade);',
        '            }',
        '        }',
        '    }',
        '',
        '    gl_FragColor = vec4(linearToSRGB(color * faceShading()), 1.0);',
        '}'
    ].join('\n');

    var DEFAULT_BASE_COLOR = 0xd8dde3;
    var DEFAULT_SHADING_STRENGTH = 0.55;
    var DEFAULT_BORDER_SHARPNESS = 30;

    function option(settings, name, fallback) {
        return settings[name] === undefined ? fallback : settings[name];
    }

    /**
     * An oblique light direction for the site, built from its local frame so
     * that walls and roofs always catch different amounts of light, wherever on
     * the globe the site is.
     *
     * @param {THREE.Vector3} [reference] - a position on the site, in EPSG:4978.
     */
    function siteLightDirection(THREE, reference) {
        var up = reference && reference.lengthSq() > 0
            ? reference.clone().normalize()
            : new THREE.Vector3(0, 0, 1);
        var aside = new THREE.Vector3(0, 0, 1);
        if (Math.abs(up.dot(aside)) > 0.9) {
            aside.set(1, 0, 0);
        }
        var east = new THREE.Vector3().crossVectors(up, aside).normalize();
        var north = new THREE.Vector3().crossVectors(up, east).normalize();
        return up.multiplyScalar(0.75)
            .addScaledVector(east, 0.5)
            .addScaledVector(north, 0.25)
            .normalize();
    }

    function whitePixel(THREE) {
        var texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
        texture.needsUpdate = true;
        return texture;
    }

    function build(THREE, settings) {
        var material = new THREE.ShaderMaterial({
            uniforms: settings.uniforms,
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            side: THREE.DoubleSide,
            // Needed for dFdx/dFdy on WebGL 1; ignored on WebGL 2.
            extensions: { derivatives: true }
        });

        /** Opacity of the projected photograph, over the whole image. */
        material.setProjectionOpacity = function (opacity) {
            material.uniforms.projectionOpacity.value = opacity;
        };

        /** Whether the image edges are softened, or applied at a hard edge. */
        material.setBorderFade = function (enabled) {
            material.uniforms.borderFade.value = enabled ? 1 : 0;
        };

        /** 0 keeps every face flat; 1 is the strongest shading. */
        material.setShadingStrength = function (strength) {
            material.uniforms.shadingStrength.value = strength;
        };

        return material;
    }

    function commonUniforms(THREE, settings) {
        return {
            baseColor: { value: new THREE.Color(option(settings, 'baseColor', DEFAULT_BASE_COLOR)) },
            lightDirection: {
                value: settings.lightDirection || siteLightDirection(THREE, settings.referencePosition)
            },
            shadingStrength: { value: option(settings, 'shadingStrength', DEFAULT_SHADING_STRENGTH) },
            projectionOpacity: { value: option(settings, 'opacity', 1) },
            borderSharpness: { value: option(settings, 'borderSharpness', DEFAULT_BORDER_SHARPNESS) },
            borderFade: { value: settings.borderFade === false ? 0 : 1 }
        };
    }

    /**
     * The buildings' material when no photograph is projected on them: the base
     * colour, flat shaded so the volumes read.
     *
     * @param {Object} [options] - referencePosition (THREE.Vector3, EPSG:4978),
     *      baseColor, shadingStrength.
     * @returns {THREE.ShaderMaterial}
     */
    function createShadedMaterial(options) {
        var THREE = itowns.THREE;
        var settings = options || {};
        var uniforms = commonUniforms(THREE, settings);

        uniforms.map = { value: whitePixel(THREE) };
        uniforms.photoEnabled = { value: 0 };
        uniforms.projectorPosition = { value: new THREE.Vector3() };
        uniforms.projectorRotationInverse = { value: new THREE.Matrix4() };
        uniforms.focal = { value: 1 };
        uniforms.principalPoint = { value: new THREE.Vector2() };
        uniforms.imageSize = { value: new THREE.Vector2(1, 1) };
        uniforms.distortionCenter = { value: new THREE.Vector2() };
        uniforms.distortionCoefficients = { value: new THREE.Vector3() };
        uniforms.distortionLimitSquared = { value: 1e20 };

        return build(THREE, { uniforms: uniforms });
    }

    /**
     * The buildings' material with one photograph projected onto them.
     *
     * @param {THREE.Camera} projector - camera carrying the MicMac pose.
     * @param {Object} calibration - parsed MicMac calibration: focal, size,
     *      point (principal point) and distortion ({ C: Vector2, R: Vector4 }).
     * @param {THREE.Texture} texture - the photograph.
     * @param {Object} [options] - opacity (0-1, applied to the whole image),
     *      borderFade (soften the image edges, default true), baseColor,
     *      borderSharpness, shadingStrength, lightDirection.
     * @returns {THREE.ShaderMaterial}
     */
    function createProjectiveTextureMaterial(projector, calibration, texture, options) {
        var THREE = itowns.THREE;
        var settings = options || {};

        projector.updateMatrixWorld(true);

        // Rotation (and MicMac axis flip) only: the translation is handled by the
        // relative position the vertex shader computes.
        var rotationInverse = new THREE.Matrix4().copy(projector.matrixWorld);
        rotationInverse.setPosition(0, 0, 0);
        rotationInverse.invert();

        var distortion = calibration.distortion;
        var limitSquared = distortion && isFinite(distortion.R.w) ? distortion.R.w : 1e20;

        if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
        }

        if (settings.referencePosition === undefined && settings.lightDirection === undefined) {
            settings.referencePosition = projector.position;
        }
        var uniforms = commonUniforms(THREE, settings);

        uniforms.map = { value: texture };
        uniforms.photoEnabled = { value: texture ? 1 : 0 };
        uniforms.projectorPosition = { value: projector.position.clone() };
        uniforms.projectorRotationInverse = { value: rotationInverse };
        uniforms.focal = { value: calibration.focal };
        uniforms.principalPoint = { value: new THREE.Vector2(calibration.point[0], calibration.point[1]) };
        uniforms.imageSize = { value: new THREE.Vector2(calibration.size[0], calibration.size[1]) };
        uniforms.distortionCenter = {
            value: distortion ? distortion.C.clone() : new THREE.Vector2(calibration.point[0], calibration.point[1])
        };
        uniforms.distortionCoefficients = {
            value: distortion
                ? new THREE.Vector3(distortion.R.x, distortion.R.y, distortion.R.z)
                : new THREE.Vector3()
        };
        uniforms.distortionLimitSquared = { value: limitSquared };

        return build(THREE, { uniforms: uniforms });
    }

    window.AlegoriaProjectiveTexture = {
        create: createProjectiveTextureMaterial,
        createShaded: createShadedMaterial
    };
}());
