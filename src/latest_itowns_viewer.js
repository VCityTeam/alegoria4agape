(function () {
    'use strict';

    function $(id) {
        return document.getElementById(id);
    }

    function textOf(xml, tagName, fallback) {
        var node = xml.getElementsByTagName(tagName)[0];
        if (!node || !node.textContent) {
            return fallback;
        }
        return node.textContent.trim();
    }

    function numbersOf(xml, tagName, fallback) {
        var text = textOf(xml, tagName, '');
        if (!text) {
            return fallback || [];
        }
        return text.split(/\s+/).filter(Boolean).map(Number);
    }

    function radToDeg(radians) {
        var THREE = itowns.THREE;
        if (THREE.MathUtils && THREE.MathUtils.radToDeg) {
            return THREE.MathUtils.radToDeg(radians);
        }
        if (THREE.Math && THREE.Math.radToDeg) {
            return THREE.Math.radToDeg(radians);
        }
        return radians * 180 / Math.PI;
    }

    function degToRad(degrees) {
        var THREE = itowns.THREE;
        if (THREE.MathUtils && THREE.MathUtils.degToRad) {
            return THREE.MathUtils.degToRad(degrees);
        }
        if (THREE.Math && THREE.Math.degToRad) {
            return THREE.Math.degToRad(degrees);
        }
        return degrees * Math.PI / 180;
    }

    function firstChildElement(xml, tagName) {
        var node = xml.getElementsByTagName(tagName)[0];
        return node && node.children && node.children[0];
    }

    function fetchText(url) {
        return fetch(url, { cache: 'no-store' }).then(function (response) {
            if (!response.ok) {
                var error = new Error('Error loading ' + url + ': status ' + response.status);
                error.status = response.status;
                error.url = url;
                throw error;
            }
            return response.text();
        });
    }

    function normalizeWmtsSource(source) {
        if (!source.crs) {
            source.crs = source.projection || (source.tileMatrixSet === 'WGS84' || source.tileMatrixSet === 'WGS84G' ? 'EPSG:4326' : 'EPSG:3857');
        }
        return source;
    }

    function addLayerStatus(message, isError) {
        var log = $('statusLog');
        if (!log) {
            return;
        }
        var line = document.createElement('div');
        line.className = isError ? 'status-error' : 'status-line';
        line.textContent = message;
        log.prepend(line);
    }

    function setStatus(message, isError) {
        var status = $('viewerStatus');
        if (!status) {
            return;
        }
        status.textContent = message;
        status.className = isError ? 'error' : '';
        if (message) {
            addLayerStatus(message, isError);
        }
    }

    function addWmtsLayer(view, id, url, isElevation) {
        return itowns.Fetcher.json(url)
            .then(function (config) {
                config.source = new itowns.WMTSSource(normalizeWmtsSource(config.source));
                var layer = isElevation ? new itowns.ElevationLayer(config.id || id, config) : new itowns.ColorLayer(id, config);
                return view.addLayer(layer);
            })
            .then(function () {
                addLayerStatus('Loaded ' + id, false);
            })
            .catch(function (error) {
                console.warn('Could not load layer ' + id, error);
                addLayerStatus('Could not load ' + id, true);
            });
    }

    var LAYER_CONFIG_PATH = 'config/layers/JSONLayers/';

    function colorBuildings(properties) {
        var color = new itowns.THREE.Color();
        return color.set(0xd8dde3);
    }

    function altitudeBuildings(properties) {
        if (properties.altitude_minimale_sol !== undefined && properties.altitude_minimale_sol !== null) {
            return properties.altitude_minimale_sol;
        }
        if (properties.altitude_minimale_toit !== undefined && properties.altitude_minimale_toit !== null && properties.hauteur) {
            return properties.altitude_minimale_toit - properties.hauteur;
        }
        if (properties.z_min !== undefined && properties.z_min !== null && properties.hauteur) {
            return properties.z_min - properties.hauteur;
        }
        return 0;
    }

    function extrudeBuildings(properties) {
        return properties.hauteur || 0;
    }

    function acceptBuilding(properties) {
        return !!properties.hauteur && properties.hauteur > 0;
    }

    function applyBuildingMaterial(object, material) {
        var THREE = itowns.THREE;
        object.traverse(function (child) {
            if (!child.isMesh) {
                return;
            }
            child.material = material || new THREE.MeshBasicMaterial({
                color: 0xd8dde3,
                side: THREE.DoubleSide
            });
        });
    }

    function createTexture(imageUrl) {
        var THREE = itowns.THREE;
        var texture = new THREE.TextureLoader().load(imageUrl, function () {
            texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
        });
        return texture;
    }

    function createWfsSource(source) {
        source.projection = source.projection || source.crs || 'EPSG:4326';
        return new itowns.WFSSource(source);
    }

    function sameDirectoryUrl(fileName) {
        return new URL(fileName, window.location.href).href;
    }

    function createBuildingLayer(id, config) {
        if (itowns.FeatureGeometryLayer) {
            return new itowns.FeatureGeometryLayer(id, config);
        }
        var layer = new itowns.GeometryLayer(id, new itowns.THREE.Group(), config);
        layer.update = config.update;
        layer.convert = config.convert;
        layer.style = config.style;
        return layer;
    }

    function siteExtent(position, margin) {
        return {
            west: position.longitude - margin,
            east: position.longitude + margin,
            south: position.latitude - margin,
            north: position.latitude + margin
        };
    }

    function globePlacement(position) {
        return {
            coord: new itowns.Coordinates('EPSG:4326', position.longitude, position.latitude, 0),
            range: position.altitude || 2500
        };
    }

    function addSiteCenterMarker(view, siteConfig) {
        var THREE = itowns.THREE;
        var position = new itowns.Coordinates('EPSG:4326',
            siteConfig.positionOnGlobe.longitude,
            siteConfig.positionOnGlobe.latitude,
            80).as('EPSG:4978').toVector3();
        var marker = new THREE.Group();
        var sphere = new THREE.Mesh(
            new THREE.SphereGeometry(22, 32, 16),
            new THREE.MeshBasicMaterial({
                color: siteConfig.cityKey === 'lyon' ? 0xff335f : 0x6f8cff,
                depthTest: false,
                depthWrite: false
            })
        );
        var halo = new THREE.Mesh(
            new THREE.SphereGeometry(38, 32, 16),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                opacity: 0.32,
                transparent: true,
                depthTest: false,
                depthWrite: false
            })
        );

        marker.position.copy(position);
        marker.renderOrder = 1200;
        sphere.renderOrder = 1201;
        halo.renderOrder = 1200;
        marker.add(halo);
        marker.add(sphere);
        view.scene.add(marker);
        view.notifyChange(view.camera.camera3D);
        return marker;
    }

    function addBdTopoBuildings(view, siteConfig, onBuildingMeshCreated) {
        if (!siteConfig.enableBuildings) {
            addLayerStatus('BDTopo buildings disabled for ' + siteConfig.city.label, false);
            return Promise.resolve();
        }
        if (!itowns.WFSSource || !itowns.Feature2Mesh || !itowns.FeatureProcessing) {
            addLayerStatus('BDTopo unavailable in this iTowns build', true);
            return Promise.resolve();
        }
        var meshCount = 0;

        var source = createWfsSource({
            url: sameDirectoryUrl('wfs_bdtopo_proxy.php') + '?',
            version: '2.0.0',
            typeName: 'BDTOPO_V3:batiment',
            crs: 'EPSG:4326',
            ipr: 'IGN',
            format: 'application/json',
            outputFormat: 'application/json',
            zoom: { min: 14, max: 16 },
            extent: siteExtent(siteConfig.positionOnGlobe, 0.04)
        });

        var layer = createBuildingLayer('BDTopo Buildings', {
            object3d: new itowns.THREE.Group(),
            update: itowns.FeatureProcessing.update,
            convert: itowns.Feature2Mesh.convert({
                batchId: function (property, featureId) { return featureId; },
                color: colorBuildings,
                altitude: altitudeBuildings,
                extrude: extrudeBuildings
            }),
            style: {
                fill: {
                    color: colorBuildings,
                    base_altitude: altitudeBuildings,
                    extrusion_height: extrudeBuildings,
                    levelled_roofs: true
                }
            },
            batchId: function (property, featureId) { return featureId; },
            filter: acceptBuilding,
            zoom: { min: 14 },
            onMeshCreated: function onMeshCreated(mesh) {
                meshCount += 1;
                onBuildingMeshCreated(mesh);
                setStatus('BDTopo buildings: ' + meshCount + ' mesh' + (meshCount === 1 ? '' : 'es'), false);
            },
            overrideAltitudeInToZero: true,
            buildExtent: true,
            source: source
        });
        window.alegoriaBdTopoLayer = layer;

        return view.addLayer(layer)
            .then(function () {
                addLayerStatus('BDTopo layer added; zoom in to load buildings', false);
            })
            .catch(function (error) {
                console.warn('Could not load BDTopo buildings', error);
                addLayerStatus('Could not load BDTopo buildings', true);
            });
    }

    function parseRadialDistortion(xml, principalPoint) {
        var THREE = itowns.THREE;
        var distortion = {
            C: new THREE.Vector2(principalPoint[0], principalPoint[1]),
            R: new THREE.Vector4(0, 0, 0, Infinity)
        };
        var modRad = xml.getElementsByTagName('ModRad')[0];
        if (!modRad) {
            return distortion;
        }

        var center = numbersOf(modRad, 'CDist', principalPoint);
        distortion.C.set(center[0], center[1]);
        var coefficients = Array.prototype.map.call(modRad.getElementsByTagName('CoeffDist'), function (node) {
            return Number(node.textContent.trim());
        });
        // R.w is the squared radius beyond which the projection is culled; we keep it
        // unbounded, as MicMac does not store it in the calibration file.
        distortion.R.set(coefficients[0] || 0, coefficients[1] || 0, coefficients[2] || 0, Infinity);
        return distortion;
    }

    function parseCalibration(xml) {
        var size = numbersOf(xml, 'SzIm', [1024, 768]);
        var focal = numbersOf(xml, 'F', [1024])[0] || 1024;
        var point = numbersOf(xml, 'PP', [size[0] * 0.5, size[1] * 0.5]);
        return {
            size: size,
            focal: focal,
            point: point,
            distortion: parseRadialDistortion(xml, point),
            aspect: size[0] / size[1],
            fov: radToDeg(2 * Math.atan((size[1] * 0.5) / focal))
        };
    }

    function parseOrientationMatrix(xml) {
        var THREE = itowns.THREE;
        var rotation = xml.getElementsByTagName('ParamRotation')[0];
        var encoding = rotation && rotation.children && rotation.children[0] ? rotation.children[0].tagName : '';
        var matrix = new THREE.Matrix4();

        if (encoding !== 'CodageMatr') {
            throw new Error('Unsupported MicMac rotation encoding: ' + encoding);
        }

        var l1 = numbersOf(rotation, 'L1');
        var l2 = numbersOf(rotation, 'L2');
        var l3 = numbersOf(rotation, 'L3');
        var center = numbersOf(xml, 'Centre');

        matrix.set(
            l1[0], l1[1], l1[2], 0,
            l2[0], l2[1], l2[2], 0,
            l3[0], l3[1], l3[2], 0,
            0, 0, 0, 1
        );
        matrix.setPosition(new THREE.Vector3(center[0], center[1], center[2]));
        matrix.scale(new THREE.Vector3(1, -1, -1));
        return matrix;
    }

    function makeCameraPose(orientationXml, calibration) {
        var THREE = itowns.THREE;
        var camera = new THREE.PerspectiveCamera(calibration.fov, calibration.aspect, 0.1, 10000000);
        var matrix = parseOrientationMatrix(orientationXml);

        camera.matrixAutoUpdate = false;
        camera.matrix.copy(matrix);
        camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
        camera.updateMatrixWorld(true);
        camera.matrixAutoUpdate = true;
        return camera;
    }

    function createImagePlane(camera, texture, calibration, distance, opacity) {
        var THREE = itowns.THREE;
        var height = 2 * Math.tan(degToRad(calibration.fov * 0.5)) * distance;
        var width = calibration.aspect * height;
        var material = new THREE.MeshBasicMaterial({
            map: texture,
            opacity: opacity,
            side: THREE.DoubleSide,
            transparent: opacity < 1
        });
        var plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        plane.position.set(0, 0, -distance);
        camera.add(plane);
        return plane;
    }

    function edgeFadeEnabled() {
        var toggle = $('borderFadeToggle');
        return !toggle || toggle.checked;
    }

    function projectionOpacity() {
        var input = $('projectionOpacityInput');
        var value = input ? Number(input.value) : 1;
        return isNaN(value) ? 1 : value;
    }

    function createProjectedImageMaterial(camera, calibration, texture) {
        if (!window.AlegoriaProjectiveTexture) {
            addLayerStatus('Projective texture material is not loaded', true);
            return null;
        }
        return window.AlegoriaProjectiveTexture.create(camera, calibration, texture, {
            opacity: projectionOpacity(),
            borderFade: edgeFadeEnabled()
        });
    }

    function createFrustum(camera, calibration, distance) {
        var THREE = itowns.THREE;
        var group = new THREE.Group();
        var height = 2 * Math.tan(degToRad(calibration.fov * 0.5)) * distance;
        var width = calibration.aspect * height;
        var points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(-width / 2, -height / 2, -distance),
            new THREE.Vector3(width / 2, -height / 2, -distance),
            new THREE.Vector3(width / 2, height / 2, -distance),
            new THREE.Vector3(-width / 2, height / 2, -distance)
        ];
        var vertices = [
            points[0], points[1], points[0], points[2], points[0], points[3], points[0], points[4],
            points[1], points[2], points[2], points[3], points[3], points[4], points[4], points[1]
        ];
        var geometry = new THREE.BufferGeometry().setFromPoints(vertices);
        var material = new THREE.LineBasicMaterial({ color: 0xffd166 });
        group.add(new THREE.LineSegments(geometry, material));
        camera.add(group);
        return group;
    }

    function focusViewCamera(view, camera, calibration, extraFov) {
        var viewCamera = view.camera.camera3D;
        camera.updateMatrixWorld(true);
        viewCamera.position.copy(camera.position);
        viewCamera.quaternion.copy(camera.quaternion);
        viewCamera.scale.copy(camera.scale);
        viewCamera.fov = Math.min(100, calibration.fov + (extraFov || 0));
        viewCamera.near = 0.1;
        viewCamera.far = 10000000;
        viewCamera.updateProjectionMatrix();
        viewCamera.updateMatrixWorld(true);
        view.notifyChange(viewCamera);
    }

    function imageOptions(siteConfig, pageName) {
        var params = new URLSearchParams(window.location.search);
        var imageName = params.get('imgname') || params.get('imagename');
        var images = siteConfig.images.slice();

        if (imageName) {
            images.unshift({ image: imageName, distance: 200, opacity: 1, plane: null });
        }
        if (pageName === 'globe' && images.length === 0 && siteConfig.zone.orientedImages) {
            images = siteConfig.zone.orientedImages.slice();
        }
        return images;
    }

    function fillImageSelect(images, selectedIndex, onChange) {
        var select = $('imageSelect');
        if (!select) {
            return;
        }
        select.innerHTML = '';
        images.forEach(function (item, index) {
            var option = document.createElement('option');
            option.value = String(index);
            option.textContent = item.image;
            select.appendChild(option);
        });
        select.value = String(selectedIndex);
        select.onchange = function () {
            onChange(Number(select.value));
        };
    }

    function addUploadedImages(images, uploaded) {
        var firstIndex = -1;
        uploaded.forEach(function (imageName) {
            var existingIndex = images.findIndex(function (item) {
                return item.image === imageName;
            });
            if (existingIndex === -1) {
                images.unshift({ image: imageName, distance: 200, opacity: 1, plane: null });
                firstIndex = 0;
            } else if (firstIndex === -1) {
                firstIndex = existingIndex;
            }
        });
        return firstIndex;
    }

    function protectControlPanel() {
        var panel = $('controlPanel');
        if (!panel) {
            return;
        }
        [
            'click',
            'dblclick',
            'mousedown',
            'mouseup',
            'mousemove',
            'pointerdown',
            'pointerup',
            'pointermove',
            'wheel',
            'touchstart',
            'touchmove',
            'touchend'
        ].forEach(function (type) {
            panel.addEventListener(type, function (event) {
                event.stopPropagation();
            }, false);
        });
    }

    function updateCurrentImageLabel(image) {
        var label = $('currentImage');
        if (label) {
            label.textContent = image || 'No image';
        }
    }

    function setupRegistrationTools(view, siteConfig, images, loadImage, getCurrentIndex) {
        var imageElement = $('img');
        var miniDiv = $('miniDiv');
        var computeButton = $('computeResectionButton');
        var undoButton = $('undoLastPoint');
        var pointCounter = $('countPoints');
        if (!imageElement || !miniDiv || !computeButton || !undoButton || !pointCounter) {
            return {
                setUploadedImage: function () {},
                currentImageName: function () { return ''; }
            };
        }

        var THREE = itowns.THREE;
        var pointCount = 0;
        var picked3DMarkers = [];
        var uploadedImageName = '';
        var micmacInFlight = false;

        function currentImageName() {
            if (uploadedImageName) {
                return uploadedImageName;
            }
            if (!imageElement.getAttribute('src')) {
                return '';
            }
            return decodeURIComponent(imageElement.src.split('/').pop());
        }

        function updatePointCounter() {
            pointCounter.textContent = 'Points registered: ' + pointCount;
            undoButton.disabled = pointCount < 1;
        }

        function rememberOrientedImage(imageName) {
            if (!imageName) {
                return;
            }
            try {
                localStorage.setItem('alegoria:lastOrientedImage:' + siteConfig.cityKey, imageName);
            } catch (error) {
                console.warn('Could not remember the last oriented image.', error);
            }
        }

        function orientedImagesUrl(imageName) {
            var params = new URLSearchParams();
            params.set('city', siteConfig.cityKey);
            params.set('zone', siteConfig.zoneKey);
            if (imageName) {
                params.set('imgname', imageName);
            }
            return 'oriented_images.html?' + params.toString();
        }

        function micmacQueryString(imageName) {
            var params = new URLSearchParams();
            params.set('imagename', imageName);
            params.set('city', siteConfig.cityKey);
            params.set('zone', siteConfig.zoneKey);
            return params.toString();
        }

        function disposeObject(object) {
            object.traverse(function (child) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (child.material.map) {
                        child.material.map.dispose();
                    }
                    child.material.dispose();
                }
            });
        }

        function createPickLabel(iteration) {
            var canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            var context = canvas.getContext('2d');
            context.fillStyle = '#ff3b30';
            context.beginPath();
            context.arc(32, 32, 23, 0, Math.PI * 2);
            context.fill();
            context.lineWidth = 4;
            context.strokeStyle = '#ffe066';
            context.stroke();
            context.font = 'bold 26px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = '#ffffff';
            context.fillText(iteration, 32, 34);

            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            var material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
            var sprite = new THREE.Sprite(material);
            sprite.scale.set(12, 12, 1);
            sprite.renderOrder = 1001;
            return sprite;
        }

        function show3DPicking(x, y, z, iteration) {
            var group = new THREE.Group();
            var sphere = new THREE.Mesh(
                new THREE.SphereGeometry(2.5, 24, 24),
                new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false, depthWrite: false })
            );
            sphere.renderOrder = 999;
            group.add(sphere);

            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(4.5, 0.35, 10, 48),
                new THREE.MeshBasicMaterial({ color: 0xffe066, depthTest: false, depthWrite: false })
            );
            ring.lookAt(view.camera.camera3D.position);
            ring.renderOrder = 1000;
            group.userData.ring = ring;
            group.add(ring);

            var label = createPickLabel(iteration);
            label.position.set(0, 0, 6);
            group.add(label);

            group.position.set(x, y, z);
            group.updateMatrixWorld();
            group.renderOrder = 999;
            view.scene.add(group);
            view.notifyChange(view.camera.camera3D);
            return group;
        }

        function pickBuildings(event) {
            if (!siteConfig.enableBuildings || !view.controls || !view.controls.isPaused || !view.controls.isPaused()) {
                return null;
            }
            try {
                var intersects = view.pickObjectsAt(event, 3, 'BDTopo Buildings');
                return intersects.length ? intersects[0].point : null;
            } catch (error) {
                console.warn('Building picking failed, falling back to terrain picking.', error);
                return null;
            }
        }

        function getPickedCoordinates(event) {
            var pickedBuilding = pickBuildings(event);
            if (pickedBuilding) {
                return pickedBuilding;
            }
            if (!view.controls || !view.controls.pickGeoPosition) {
                return null;
            }
            var geoposition = view.controls.pickGeoPosition(new THREE.Vector2(event.pageX, event.pageY));
            if (!geoposition) {
                return null;
            }
            var converted = geoposition.as('EPSG:4978');
            return { x: converted.x, y: converted.y, z: converted.z };
        }

        function computeResection(show) {
            var imageName = currentImageName();
            if (!imageName) {
                setStatus('Upload an image before running MicMac.', true);
                return;
            }
            if (micmacInFlight) {
                setStatus('MicMac is already running for ' + imageName + '...', false);
                return;
            }

            micmacInFlight = true;
            setStatus('Running MicMac for ' + imageName + '...', false);
            window.setTimeout(function () {
                fetch('launchMicMac.php?' + micmacQueryString(imageName), { cache: 'no-store' })
                    .then(function (response) {
                        return response.text().then(function (text) {
                            var result;
                            try {
                                result = JSON.parse(text);
                            } catch (error) {
                                throw new Error('MicMac returned an unreadable response: ' + text.slice(0, 240));
                            }
                            if (!response.ok || Number(result.status) !== 0) {
                                throw new Error(result.output || 'MicMac failed to calculate orientation.');
                            }
                            return result;
                        });
                    })
                    .then(function (result) {
                        console.log(result.command);
                        console.log(result.output);
                        rememberOrientedImage(imageName);
                        setStatus('MicMac calculations are done for ' + imageName + '. Loading oriented image...', false);
                        loadImage(getCurrentIndex(), show);
                    })
                    .catch(function (error) {
                        console.error(error);
                        setStatus(error.message, true);
                    })
                    .finally(function () {
                        micmacInFlight = false;
                    });
            }, 250);
        }

        function markReadyForResection() {
            if (pointCount >= 7) {
                setStatus('7 matched 3D points selected. Click Go to compute and display the image in 3D.', false);
            }
        }

        function initRegistrationFiles(imageName) {
            uploadedImageName = imageName;
            pointCount = 0;
            picked3DMarkers.forEach(function (marker) {
                view.scene.remove(marker);
                disposeObject(marker);
            });
            picked3DMarkers = [];
            updatePointCounter();
            if (typeof initXML2D === 'function') {
                initXML2D();
            }
            if (typeof initXML3D === 'function') {
                initXML3D();
            }
            if (typeof createCalib === 'function') {
                createCalib();
            }
            if (typeof createMicmacChantierDescripteur === 'function') {
                createMicmacChantierDescripteur();
            }
            setStatus('Image ready. Shift+click matching image points, Alt+click matching 3D points, then Go.', false);
            view.notifyChange(view.camera.camera3D);
        }

        function setUploadedImage(imageName) {
            imageElement.onload = function () {
                initRegistrationFiles(imageName);
            };
            imageElement.src = siteConfig.dataPath + encodeURIComponent(imageName);
            if (imageElement.complete && imageElement.naturalWidth) {
                initRegistrationFiles(imageName);
            }
        }

        imageElement.addEventListener('mousedown', function (event) {
            if (typeof getImgCoordOnClick === 'function') {
                getImgCoordOnClick(event);
            }
        });

        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.BEFORE_RENDER, function () {
            picked3DMarkers.forEach(function (marker) {
                if (marker.userData.ring) {
                    marker.userData.ring.lookAt(view.camera.camera3D.position);
                }
            });
        });

        $('viewerDiv').addEventListener('mousedown', function (event) {
            if (!event.altKey) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            var coordinates = getPickedCoordinates(event);
            if (!coordinates) {
                setStatus('Could not pick a 3D point at this position.', true);
                return;
            }
            pointCount += 1;
            picked3DMarkers.push(show3DPicking(coordinates.x, coordinates.y, coordinates.z, pointCount));
            if (typeof export3Dcoord === 'function') {
                export3Dcoord(pointCount, coordinates.x, coordinates.y, coordinates.z);
            }
            updatePointCounter();
            markReadyForResection();
        }, true);

        undoButton.addEventListener('click', function () {
            if (pointCount < 1) {
                return;
            }
            var marker = picked3DMarkers.pop();
            if (marker) {
                view.scene.remove(marker);
                disposeObject(marker);
            }
            if (typeof undoLast3DCoord === 'function') {
                undoLast3DCoord();
            }
            if (typeof undoLast2DCoord === 'function') {
                undoLast2DCoord(pointCount);
            }
            pointCount -= 1;
            updatePointCounter();
            view.notifyChange(view.camera.camera3D);
        });

        computeButton.addEventListener('click', function () {
            setStatus('Go clicked. Preparing MicMac launch...', false);
            computeResection(true);
        });

        window.addEventListener('keydown', function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                undoButton.click();
            }
        });

        updatePointCounter();
        return {
            setUploadedImage: setUploadedImage,
            currentImageName: currentImageName
        };
    }

    function init(options) {
        var pageName = options.pageName;
        var autoFocus = options.autoFocus;
        var viewerDiv = $('viewerDiv');
        var siteConfig = getAlegoriaSiteConfig(pageName);
        var images = imageOptions(siteConfig, pageName);
        var currentIndex = 0;
        var photoCamera = null;
        var photoPlane = null;
        var photoFrustum = null;
        var photoCalibration = null;
        var buildingMeshes = [];
        var siteCenterPosition = new itowns.Coordinates('EPSG:4326',
            siteConfig.positionOnGlobe.longitude,
            siteConfig.positionOnGlobe.latitude,
            0).as('EPSG:4978').toVector3();
        // Without a photograph the buildings still get this material, so that they
        // are shaded the same way and their corners stay readable.
        var baseBuildingMaterial = window.AlegoriaProjectiveTexture
            ? window.AlegoriaProjectiveTexture.createShaded({ referencePosition: siteCenterPosition })
            : null;
        var projectedBuildingMaterial = baseBuildingMaterial;
        var view = new itowns.GlobeView(viewerDiv, globePlacement(siteConfig.positionOnGlobe), {
            handleCollision: false,
            noControls: false,
            sseSubdivisionThreshold: 6
        });

        window.alegoriaLatestView = view;
        protectControlPanel();
        addSiteCenterMarker(view, siteConfig);

        function applyCurrentBuildingMaterial(mesh) {
            applyBuildingMaterial(mesh, projectedBuildingMaterial);
        }

        function rememberBuildingMesh(mesh) {
            buildingMeshes.push(mesh);
            applyCurrentBuildingMaterial(mesh);
        }

        function setProjectedBuildingMaterial(material) {
            projectedBuildingMaterial = material || baseBuildingMaterial;
            // Exposed like alegoriaBdTopoLayer, to tune the look from the console:
            // alegoriaBuildingMaterial.setShadingStrength(0.8)
            window.alegoriaBuildingMaterial = projectedBuildingMaterial;
            buildingMeshes.forEach(applyCurrentBuildingMaterial);
            view.notifyChange(view.camera.camera3D);
        }

        addWmtsLayer(view, 'Ortho', LAYER_CONFIG_PATH + 'Ortho.json', false);
        addWmtsLayer(view, 'WORLD_DTM', LAYER_CONFIG_PATH + 'WORLD_DTM.json', true);
        addWmtsLayer(view, 'IGN_MNT_HIGHRES', LAYER_CONFIG_PATH + 'IGN_MNT_HIGHRES.json', true);
        addBdTopoBuildings(view, siteConfig, rememberBuildingMesh);

        var registrationTools = setupRegistrationTools(view, siteConfig, images, function (index, shouldFocus) {
            loadImage(index, shouldFocus);
        }, function () {
            return currentIndex;
        });

        function clearPhoto() {
            if (photoCamera) {
                view.scene.remove(photoCamera);
                photoCamera = null;
                photoPlane = null;
                photoFrustum = null;
                photoCalibration = null;
            }
            setProjectedBuildingMaterial(null);
        }

        function loadImage(index, shouldFocus) {
            if (!images.length) {
                updateCurrentImageLabel('No image');
                setStatus('No oriented images are configured for ' + siteConfig.city.label + '; showing the site center and BDTopo buildings only.', false);
                return;
            }

            currentIndex = (index + images.length) % images.length;
            var image = images[currentIndex];
            var imageName = image.image;
            var distance = Number($('distanceInput') && $('distanceInput').value) || image.distance || 200;
            var opacity = Number($('opacityInput') && $('opacityInput').value);
            if (isNaN(opacity)) {
                opacity = image.opacity == null ? 1 : image.opacity;
            }

            setStatus('Loading ' + imageName + '...', false);
            updateCurrentImageLabel(imageName);
            clearPhoto();

            fetchText(siteConfig.outputPath + 'Ori-Aspro/Orientation-' + imageName + '.xml')
                .then(function (orientationText) {
                    var orientationXml = new DOMParser().parseFromString(orientationText, 'application/xml');
                    var calibrationPath = textOf(orientationXml, 'FileInterne', '');
                    if (!calibrationPath) {
                        throw new Error('No FileInterne in Orientation-' + imageName + '.xml');
                    }
                    return fetchText(siteConfig.outputPath + calibrationPath).then(function (calibrationText) {
                        return {
                            orientationXml: orientationXml,
                            calibrationXml: new DOMParser().parseFromString(calibrationText, 'application/xml')
                        };
                    });
                })
                .then(function (parsed) {
                    var calibration = parseCalibration(parsed.calibrationXml);
                    photoCalibration = calibration;
                    photoCamera = makeCameraPose(parsed.orientationXml, calibration);
                    var texture = createTexture(siteConfig.dataPath + imageName);
                    photoPlane = createImagePlane(photoCamera, texture, calibration, distance, opacity);
                    photoFrustum = createFrustum(photoCamera, calibration, distance);
                    view.scene.add(photoCamera);
                    setProjectedBuildingMaterial(createProjectedImageMaterial(photoCamera, calibration, texture));
                    if (shouldFocus) {
                        focusViewCamera(view, photoCamera, calibration, pageName === 'oriented_images' ? 4 : 14);
                    } else {
                        view.notifyChange(view.camera.camera3D);
                    }
                    setStatus('Loaded ' + imageName, false);
                })
                .catch(function (error) {
                    console.error(error);
                    if (error.status === 404 && error.url && error.url.indexOf('/Ori-Aspro/Orientation-') !== -1) {
                        setStatus('No orientation is available yet for ' + imageName + '. Upload succeeded, but the image still needs to be registered.', false);
                        return;
                    }
                    setStatus(error.message, true);
                });
        }

        fillImageSelect(images, currentIndex, function (index) {
            loadImage(index, autoFocus);
        });

        var uploadForm = $('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', function (event) {
                event.preventDefault();
                var input = $('uploadInput');
                if (!input || !input.files || input.files.length === 0) {
                    setStatus('Choose at least one image to upload.', true);
                    return;
                }

                setStatus('Uploading image...', false);
                fetch('process.php', {
                    method: 'POST',
                    body: new FormData(uploadForm)
                })
                    .then(function (response) {
                        return response.json().then(function (result) {
                            if (!response.ok) {
                                throw new Error((result.errors || [result.error || 'Upload failed']).join('; '));
                            }
                            return result;
                        });
                    })
                    .then(function (result) {
                        var uploaded = result.uploaded || [];
                        if (!uploaded.length) {
                            setStatus('Upload finished, but no image was saved.', true);
                            return;
                        }
                        var index = addUploadedImages(images, uploaded);
                        fillImageSelect(images, index, function (selectedIndex) {
                            loadImage(selectedIndex, autoFocus);
                        });
                        uploadForm.reset();
                        updateCurrentImageLabel(uploaded[0]);
                        if (pageName === 'globe') {
                            currentIndex = index;
                            registrationTools.setUploadedImage(uploaded[0]);
                            setStatus('Uploaded ' + uploaded.join(', ') + '. Register the image before loading it as an oriented image.', false);
                            return;
                        }
                        setStatus('Uploaded ' + uploaded.join(', '), false);
                        loadImage(index, autoFocus);
                    })
                    .catch(function (error) {
                        console.error(error);
                        setStatus(error.message, true);
                    });
            });
        }

        var nextButton = $('nextButton');
        if (nextButton) {
            nextButton.addEventListener('click', function () {
                loadImage(currentIndex + 1, autoFocus);
            });
        }

        var focusButton = $('focusButton');
        if (focusButton) {
            focusButton.addEventListener('click', function () {
                if (photoCamera && photoCalibration) {
                    focusViewCamera(view, photoCamera, photoCalibration, pageName === 'oriented_images' ? 4 : 14);
                } else {
                    loadImage(currentIndex, true);
                }
            });
        }

        var resetButton = $('resetButton');
        if (resetButton) {
            resetButton.addEventListener('click', function () {
                var position = new itowns.Coordinates('EPSG:4326',
                    siteConfig.positionOnGlobe.longitude,
                    siteConfig.positionOnGlobe.latitude,
                    siteConfig.positionOnGlobe.altitude);
                var target = new itowns.Coordinates('EPSG:4326',
                    siteConfig.positionOnGlobe.longitude,
                    siteConfig.positionOnGlobe.latitude,
                    0);
                view.camera.setPosition(position);
                view.camera.camera3D.lookAt(target.as('EPSG:4978').toVector3());
                view.notifyChange(view.camera.camera3D);
            });
        }

        var distanceInput = $('distanceInput');
        if (distanceInput) {
            distanceInput.addEventListener('change', function () {
                loadImage(currentIndex, autoFocus);
            });
        }

        var opacityInput = $('opacityInput');
        if (opacityInput) {
            opacityInput.addEventListener('input', function () {
                if (photoPlane && photoPlane.material) {
                    photoPlane.material.opacity = Number(opacityInput.value);
                    photoPlane.material.transparent = photoPlane.material.opacity < 1;
                    view.notifyChange(view.camera.camera3D);
                }
            });
        }

        // Opacity of the photograph projected on the buildings, over the whole
        // image, independently of the plane in front of the camera.
        var projectionOpacityInput = $('projectionOpacityInput');
        if (projectionOpacityInput) {
            projectionOpacityInput.addEventListener('input', function () {
                if (projectedBuildingMaterial) {
                    projectedBuildingMaterial.setProjectionOpacity(projectionOpacity());
                    view.notifyChange(view.camera.camera3D);
                }
            });
        }

        var borderFadeToggle = $('borderFadeToggle');
        if (borderFadeToggle) {
            borderFadeToggle.addEventListener('change', function () {
                if (projectedBuildingMaterial) {
                    projectedBuildingMaterial.setBorderFade(borderFadeToggle.checked);
                    view.notifyChange(view.camera.camera3D);
                }
            });
        }

        var frustumToggle = $('frustumToggle');
        if (frustumToggle) {
            frustumToggle.addEventListener('change', function () {
                if (photoFrustum) {
                    photoFrustum.visible = frustumToggle.checked;
                    view.notifyChange(view.camera.camera3D);
                }
            });
        }

        loadImage(currentIndex, autoFocus);
    }

    window.AlegoriaLatestViewer = {
        init: init
    };
}());
