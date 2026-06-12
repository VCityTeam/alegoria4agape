(function () {
    'use strict';

    var defaultOrientedImages = [
        { image: 'planNotreDame.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'plandetailleCite.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'notredame.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1919_CAF_C-1_0012.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1951_DUR_208_0007.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1951_DUR_214_0024.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1951_DUR_214_0022.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1919_CAF_Z-36_0008.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'trocadero2.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'FRAN_0207_3299_L.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'FRAN_0207_0648_L.jpg', distance: 200, opacity: 1, plane: null }
    ];

    var globeImages = [
        { image: 'LOC-04753X.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'notredame.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'rueVieilleDuTemple8.jpg', distance: 600, opacity: 1, plane: null },
        { image: 'planNotreDame.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'plandetailleCite.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'pontlouisphilippe.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1919_CAF_C-1_0012.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1951_DUR_208_0007.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1951_DUR_214_0024.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1951_DUR_214_0022.jpg', distance: 200, opacity: 1, plane: null },
        { image: '1919_CAF_Z-36_0008.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'trocadero2.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'FRAN_0207_3299_L.jpg', distance: 200, opacity: 1, plane: null },
        { image: 'FRAN_0207_0648_L.jpg', distance: 200, opacity: 1, plane: null }
    ];

    var lyonOrientedImages = [];
    var lyonGlobeImages = [];

    window.ALEGORIA_SITES = {
        defaultCity: 'paris',
        defaultZone: 'default',
        cities: {
            paris: {
                label: 'Paris',
                dataPath: '../data/',
                outputPath: '../outputs/test/',
                enableBuildings: true,
                positionOnGlobe: { longitude: 2.3186303566461626, latitude: 48.86426741804917, altitude: 1878.615379151888 },
                zones: {
                    default: {
                        label: 'Paris',
                        orientedImages: defaultOrientedImages,
                        globeImages: globeImages
                    }
                }
            },
            lyon: {
                label: 'Lyon',
                dataPath: '../data/',
                outputPath: '../outputs/test/',
                enableBuildings: false,
                positionOnGlobe: { longitude: 4.835659, latitude: 45.764043, altitude: 1878.615379151888 },
                zones: {
                    default: {
                        label: 'Lyon',
                        orientedImages: lyonOrientedImages,
                        globeImages: lyonGlobeImages
                    }
                }
            }
        }
    };

    function cloneImages(images) {
        return images.map(function (item) {
            return {
                image: item.image,
                distance: item.distance,
                opacity: item.opacity,
                plane: null
            };
        });
    }

    function inferCityFromPath(pathname) {
        var parts = pathname.split('/').filter(Boolean);
        var srcIndex = parts.indexOf('src');
        if (srcIndex !== -1 && parts[srcIndex + 1] && !/\.html$/.test(parts[srcIndex + 1])) {
            return parts[srcIndex + 1];
        }
        return null;
    }

    window.getAlegoriaSiteConfig = function (pageName) {
        var params = new URLSearchParams(window.location.search);
        var cityKey = params.get('city') || params.get('site') || inferCityFromPath(window.location.pathname) || window.ALEGORIA_SITES.defaultCity;
        var city = window.ALEGORIA_SITES.cities[cityKey] || window.ALEGORIA_SITES.cities[window.ALEGORIA_SITES.defaultCity];
        var zoneKey = params.get('zone') || params.get('quartier') || window.ALEGORIA_SITES.defaultZone;
        var zone = city.zones[zoneKey] || city.zones[window.ALEGORIA_SITES.defaultZone];
        var images = pageName === 'globe' ? zone.globeImages : zone.orientedImages;

        return {
            cityKey: cityKey,
            city: city,
            zoneKey: zoneKey,
            zone: zone,
            images: cloneImages(images || []),
            positionOnGlobe: Object.assign({}, zone.positionOnGlobe || city.positionOnGlobe),
            dataPath: zone.dataPath || city.dataPath || '../data/',
            outputPath: zone.outputPath || city.outputPath || '../outputs/test/',
            enableBuildings: zone.enableBuildings !== undefined ? zone.enableBuildings : city.enableBuildings !== false
        };
    };
}());
