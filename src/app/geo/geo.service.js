/* global geoapi */
(() => {
    'use strict';

    /**
     * @ngdoc service
     * @name geoService
     * @module app.geo
     *
     * @description
     * `geoService` wraps all calls to geoapi and also tracks the state of anything map related
     * (ex: layers, filters, extent history).
     */
    angular
        .module('app.geo')
        .factory('geoService', geoService);

    function geoService($http, $q, identifyService, layerTypes, configDefaults) {

        // TODO update how the layerOrder works with the UI
        // Make the property read only. All angular bindings will be a one-way binding to read the state of layerOrder
        // Add a function to update the layer order. This function will raise a change event so other interested
        // pieces of code can react to the change in the order

        const service = {
            layers: {},
            layerOrder: [],
            buildMap,
            epsgLookup,
            getFormattedAttributes,
            registerLayer,
            registerAttributes,
            setZoom,
            shiftZoom,
            selectBasemap,
            setFullExtent,
            setLayerVisibility,
            removeLayer,
            zoomToGraphic
        };

        let mapDomNode = null;
        let mapPromise = null;
        let identifyPromise = null;
        let mapManagerPromise = null;

        let fullExtent = null;

        // selected basemap id and extentSetId
        let selectedBasemapId = null;
        let selectedBasemapExtentSetId = null;

        // FIXME: need to find a way to have the dojo URL set by the config
        service.promise = geoapi('http://js.arcgis.com/3.14/', window)
            .then(initializedGeoApi => service.gapi = initializedGeoApi);

        return service;

        /**
         * Sets layer visiblity value.
         * @param {Number} layerId id of the layer in the layer registry
         * @param {String} value   visibility state; Visibility value has four states: 'on', 'off', 'zoomIn', and 'zoomOut'. The first two can be set as initial layer visibility states; the last two are for internal use only. Any value except for 'on' means the layer is hidden. 'off', 'zoomIn', and 'zoomOut' specify an icon and action for the layer toggle.
         * TODO: needs more work for toggling on/off dynamic layers and its children;
         */
        function setLayerVisibility(layerId, value) {
            const l = service.layers[layerId];

            if (l) {
                l.state.options.visibility.value = value; // update layer state value
                l.layer.setVisibility(value === 'on' ? true : false);
            }
        }

        /**
         * Removes the layer from the map and from the layer registry
         * @param {Number} layerId  the id of the layer to be removed
         * TODO: needs more work for removing dynamic layers and its children;
         */
        function removeLayer(layerId) {

            mapPromise.then(map => {
                const l = service.layers[layerId];

                if (!l) {
                    return;
                }

                map.removeLayer(l.layer);

                // TODO: needs more work to manager layerOrder
                const index = service.layerOrder.indexOf(layerId);
                if (index !== -1) {
                    service.layerOrder.splice(index, 1);
                }
            });

        }

        /**
         * Adds a layer object to the layers registry
         * @param {object} layer the API layer object
         * @param {object} initialState a configuration fragment used to generate the layer
         * @param {object} attribs an optional object containing the attributes associated with the layer
         * @param {number} position an optional index indicating at which position the layer was added to the map
         * (if supplied it is the caller's responsibility to make sure the layer is added in the correct location)
         */
        function registerLayer(layer, initialState, attribs, position) {
            // TODO determine the proper docstrings for a non-service function that lives in a service

            if (!layer.id) {
                // TODO replace with proper error handling mechanism
                console.error('Attempt to register layer without id property');
                console.log(layer);
                console.log(initialState);
            }

            if (service.layers[layer.id]) {
                // TODO replace with proper error handling mechanism
                console.log('Error: attempt to register layer already registered.  id: ' + layer.id);
            }

            // TODO should attribs be defined and set to null, or simply omitted from the object?  some layers will not have attributes. others will be added after they load
            let l = {
                layer,

                // apply layer option defaults
                state: angular.merge({}, configDefaults.layerOptions, configDefaults.layerFlags, initialState)
            };

            if (attribs) {
                l.attribs = attribs;
            }
            service.layers[layer.id] = l;

            if (position === undefined) {
                position = service.layerOrder.length;
            }
            service.layerOrder.splice(position, 0, layer.id);

            // TODO: apply config values
            service.setLayerVisibility(l.layer.id, l.state.options.visibility.value);
        }

        /**
         * Adds an attribute dataset to the layers registry
         * @param  {object} attribData an attribute dataset
         */
        function registerAttributes(attribData) {
            // TODO determine the proper docstrings for a non-service function that lives in a service

            if (!attribData.layerId) {
                // TODO replace with proper error handling mechanism
                console.log('Error: attempt to register attribute dataset without layerId property');
            }

            if (!service.layers[attribData.layerId]) {
                // TODO replace with proper error handling mechanism
                console.log('Error: attempt to register layer attributes against unregistered layer.  id: ' +
                    attribData.layerId);
            }

            service.layers[attribData.layerId].attribs = attribData;
        }

        /**
         * Returns nicely bundled attributes for the layer described by layerId.
         * The bundles are used in the datatable.
         *
         * @param   {String} layerId        The id for the layer
         * @param   {String} featureIndex   The index for the feature (attribute set) within the layer
         * @return  {?Object}               The column headers and data to show in the datatable
         */
        function getFormattedAttributes(layerId, featureIndex) {
            if (!service.layers[layerId]) {
                throw new Error('Cannot get attributes for unregistered layer');
            }
            if (!service.layers[layerId].attribs) {
                // return null as attributes are not loaded yet
                return null;
            }
            if (!service.layers[layerId].attribs[featureIndex]) {
                throw new Error('Cannot get attributes for feature that does not exist');
            }

            // get the attributes and single out the first one
            const attr = service.layers[layerId].attribs[featureIndex];
            const first = attr.features[0];

            // columns for the data table
            const columns = [];

            // data for the data table
            const data = [];

            // used to track order of columns
            const columnOrder = [];

            // get the attribute keys to use as column headers
            Object.keys(first.attributes)
                .forEach((key, index) => {
                    columns[index] = {
                        title: key
                    };
                    columnOrder[index] = key;
                });

            // get the attribute data from every feature
            attr.features.forEach((element, index) => {
                data[index] = [];
                angular.forEach(element.attributes, (value, key) => {
                    data[index][columnOrder.indexOf(key)] = value;
                });
            });

            return {
                columns,
                data
            };
        }

        /**
         * Takes a layer in the config format and generates an appropriate layer object.
         * @param {object} layerConfig a configuration fragment for a single layer
         * @param {object} identify FIXME: description
         * @return {object} a layer object matching one of the esri/layers objects based on the layer type
         */
        function generateLayer(layerConfig, identify) {
            const handlers = {};
            const commonConfig = {
                id: layerConfig.id,
                visible: layerConfig.visibility === 'on',
                opacity: layerConfig.opacity || 1
            };

            handlers[layerTypes.esriDynamic] = config => {
                const l = new service.gapi.layer.ArcGISDynamicMapServiceLayer(config.url, commonConfig);
                identify.addDynamicLayer(l, config.name);
                return l;
            };
            handlers[layerTypes.esriFeature] = config => {
                commonConfig.mode = config.snapshot ?
                    service.gapi.layer.FeatureLayer.MODE_SNAPSHOT :
                    service.gapi.layer.FeatureLayer.MODE_ONDEMAND;
                const l = new service.gapi.layer.FeatureLayer(config.url, commonConfig);
                identify.addFeatureLayer(l, config.name);
                return l;
            };
            handlers[layerTypes.esriImage] = config => {

                // FIXME don't hardcode opacity
                commonConfig.opacity = 0.3;
                return new service.gapi.layer.ArcGISImageServiceLayer(config.url, commonConfig);
            };
            handlers[layerTypes.esriTile] = config => {
                return new service.gapi.layer.TileLayer(config.url, commonConfig);
            };
            handlers[layerTypes.ogcWms] = config => {
                commonConfig.visibleLayers = [config.layerName];
                return new service.gapi.layer.WmsLayer(config.url, commonConfig);
            };

            if (handlers.hasOwnProperty(layerConfig.layerType)) {
                return handlers[layerConfig.layerType](layerConfig);
            } else {
                throw new Error('Your layer type is unacceptable');
            }
        }

        /**
         * Lookup a proj4 style projection definition for a given ESPG code.
         * @param {string|number} code the EPSG code as a string or number
         * @return {Promise} a Promise resolving to proj4 style definition or null if the definition could not be found
         */
        function epsgLookup(code) {
            // FIXME this should be moved to a plugin; it is hardcoded to use epsg.io

            const urnRegex = /urn:ogc:def:crs:EPSG::(\d+)/;
            const epsgRegex = /EPSG:(\d+)/;
            let lookup = code;
            if (typeof lookup === 'number') {
                lookup = String(lookup);
            }
            const urnMatches = lookup.match(urnRegex);
            if (urnMatches) {
                lookup = urnMatches[1];
            }
            const epsgMatches = lookup.match(epsgRegex);
            if (epsgMatches) {
                lookup = epsgMatches[1];
            }

            return $http.get(`http://epsg.io/${lookup}.proj4`)
                .then(response => {
                    return response.data;
                })
                .catch(err => {
                    console.warn(err);

                    // jscs check doesn't realize return null; returns a promise
                    return null; // jscs:ignore jsDoc
                });
        }

        /**
         * Constructs a map on the given DOM node.
         * @param {object} domNode the DOM node on which the map should be initialized
         * @param {object} config the map configuration based on the configuration schema
         */
        function buildMap(domNode, config) {
            console.log('superBuildMap');

            if (!mapDomNode) {
                mapDomNode = domNode;
            }

            // reset before rebuilding the map
            if (mapPromise) {
                mapPromise.then(map => {

                    map.destroy();
                    service.layers = {};

                    fullExtent = null;

                });
            }

            if (mapManagerPromise) {
                mapManagerPromise.then(mapManager => {
                    mapManager.BasemapControl.basemapGallery.destroy();
                    mapManager.OverviewMapControl.destroy();
                    mapManager.ScalebarControl.destroy();
                });
            }

            // if no selected basemap, use the first item
            if (!selectedBasemapId) {
                setSelectedBaseMap(config.baseMaps[0].id, config);
            }

            // create a basemap object
            const basemapConfig = getBasemapConfig(selectedBasemapId, config);
            const basemap = getBasemapFromJson(basemapConfig);

            mapPromise = buildMapPromise(basemap, domNode);

            mapPromise.then(map => {

                mapManagerPromise = $q((resolve, reject) => {
                    const mapManager = service.gapi.mapManager.setupMap(map, config);

                    if (mapManager) {
                        resolve(mapManager);
                    } else {
                        reject('failed to setup mapManager');
                    }
                });

                // mapManager = service.gapi.mapManager.setupMap(map, config);
                if (config.services && config.services.proxyUrl) {
                    service.gapi.mapManager.setProxy(config.services.proxyUrl);
                }

                identifyPromise = $q((resolve, reject) => {
                    const identify = identifyService(service.gapi, map, service.layers);

                    if (identify) {
                        resolve(identify);
                    } else {
                        reject('failed to setup identify service');
                    }
                }).then(identify => {

                    // setup layers
                    setupLayers(config, map, identify);
                }).catch(err => {
                    console.error('identify not available. Err:' + err);
                });

                initMapFullExtentValue(config, map);
            });

            // FIXME temp link for debugging
            window.FGPV = {
                layers: service.layers
            };
        }

        /**
         * Switch basemap based on the uid provided.
         * @param {string} id identifier for a specific basemap layerbower
         */
        function selectBasemap(id, configService) {

            mapManagerPromise.then(mapManager => {

                return mapPromise.then(map=> {
                    mapManager.BasemapControl.setBasemap(id);

                    // check to see if spatial references are the same
                    const newBasemap = getBasemapConfig(id, configService);
                    const oldBasemap = getBasemapConfig(selectedBasemapId, configService);

                    if (newBasemap.wkid === oldBasemap.wkid) {
                        console.log('same wkid: ' + newBasemap.wkid);
                        mapManager.BasemapControl.setBasemap(id);
                        mapManager.OverviewMapControl.destroy();
                        mapManager.OverviewMapControl = service.gapi.mapManager.getOverviewMap(map, configService);
                        mapManager.OverviewMapControl.startup();
                    } else {

                        // extent is different, build the map
                        console.log('different wkid: ' + newBasemap.wkid);
                        setSelectedBaseMap(id, configService);
                        buildMap(mapDomNode, configService);
                    }

                });
            }).catch(err => {
                console.error('selectBasemap: ' + err);
            });

        }

        /**
         * Sets zoom level of the map to the specified level
         * @param {number} value a zoom level number
         */
        function setZoom(value) {
            mapPromise.then(map => {
                map.setZoom(value);
            }).catch(err => {
                console.warn('GeoService: map is not yet created.  Err:' + err);
            });

        }

        /**
         * Changes the zoom level by the specified value relative to the current level; can be negative
         * @param  {number} byValue a number of zoom levels to shift by
         */
        function shiftZoom(byValue) {
            mapPromise.then(map => {
                let newValue = map.getZoom() + byValue;
                map.setZoom(newValue);
            }).catch(err => {
                console.warn('GeoService: map is not yet created. Err:' + err);
            });
        }

        /**
         * Set the map to full extent
         */
        function setFullExtent() {
            mapPromise.then(map => {
                if (fullExtent) {
                    console.log('setFullExtent');
                    console.log(fullExtent);
                    map.setExtent(fullExtent);
                } else {
                    console.warn('GeoService: fullExtent value is not set.');
                }
            }).catch(err => {
                console.warn('GeoService: map is not yet created. Err:' + err);
            });

        }

        /*
        * Retrieve full extent from extentSets
        * @param {object} extentSets from config settings of map
        * @return {object} fullExtent from map settings
        */
        function getFullExtFromExtentSets(extentSets) {

            // In configSchema, at least one extent for a basemap
            const extentSetForId = extentSets.find(extentSet => {
                if (extentSet.id === selectedBasemapExtentSetId) {
                    return true;
                }
            });

            // no matching id in the extentset
            if (angular.isUndefined(extentSetForId)) {
                throw new Error('could not find an extent set with matching id.');
            }

            // find the full extent type from extentSetForId
            const lFullExtent = (extentSetForId.full) ? extentSetForId.full :
                (extentSetForId.default) ? extentSetForId.default :
                (extentSetForId.maximum) ? extentSetForId.maximum : null;

            return lFullExtent;

        }

        // only handles feature layers right now. zoom to dynamic/wms layers obj won't work
        /**
         * Fetches a point in a layer given the layerUrl and objId of the object and then zooms to it
         * @param  {layerUrl} layerUrl is the URL that the point to be zoomed to belongs to
         * @param  {objId} objId is ID of object that was clicked on datatable to be zoomed to
         */
        function zoomToGraphic(layerUrl, objId) {
            const geo = service.gapi.layer.getFeatureInfo(layerUrl, objId);
            geo.then(geoInfo => {
                if (geoInfo) {
                    mapPromise.then(map => {
                        map.centerAndZoom(geoInfo.feature.geometry, 10);
                    });
                }
            });
        }

        /**
        * set selected basemap values
        * internal use only
        */
        function setSelectedBaseMap(id, config) {

            selectedBasemapId = id;
            const selectedBaseMapConfig = getBasemapConfig(selectedBasemapId, config);
            selectedBasemapExtentSetId = selectedBaseMapConfig.extentId;

        }

        /**
        * set up map full extent value
        * @param {object} config settings
        * @param {object} map esri map object
        */
        function initMapFullExtentValue(config, map) {

            let lFullExtent = getFullExtFromExtentSets(config.map.extentSets);

            // map extent is not available until map is loaded
            if (lFullExtent) {

                // compare map extent and setting.extent spatial-references
                // make sure the full extent has the same spatial reference as the map
                if (service.gapi.proj.isSpatialRefEqual(map.extent.spatialReference,
                    lFullExtent.spatialReference)) {

                    // same spatial reference, no reprojection required
                    console.log('same spatial reference');
                    fullExtent = service.gapi.mapManager.getExtentFromJson(lFullExtent);
                } else {

                    // need to re-project
                    console.log('different spatial reference, needs re-projection');
                    fullExtent = service.gapi.proj.projectEsriExtent(
                        service.gapi.mapManager.getExtentFromJson(lFullExtent),
                        map.extent.spatialReference);
                }
            }
        }

        /**
        * Setup map layers from config settings
        * @param {object} config settings
        * @param {object} map esri map object
        */
        function setupLayers(config, map, identify) {
            config.layers.forEach(layerConfig => {
                const l = generateLayer(layerConfig, identify);
                registerLayer(l, layerConfig); // https://reviewable.io/reviews/fgpv-vpgf/fgpv-vpgf/286#-K9cmkUQO7pwtwEPOjmK
                map.addLayer(l);

                // wait for layer to load before registering
                service.gapi.events.wrapEvents(l, {
                    load: () => {
                        // get the attributes for the layer
                        const a = service.gapi.attribs.loadLayerAttribs(l);

                        // TODO: leave a promise in the layer object that resolves when the attributes are loaded/registered
                        a.then(data => {
                            registerAttributes(data);
                        })
                        .catch(exception => {
                            console.log('Error getting attributes for ' + l.name + ': ' +
                                exception);
                            console.log(l);
                        });
                    }
                });
            });
        }

        /*
         * Get basemap config from basemap id
         * @param id base Map id
         * @param config config object
         * @return {object} base map json object
         */
        function getBasemapConfig(id, config) {
            return config.baseMaps.find(basemapConfig => {
                return (basemapConfig.id === id);
            });
        }

        /*
        * create a basemap from a basemap config setting
        * @param {object} basemapConfig in JSON format
        * @return {object} esri basemap object
        */
        function getBasemapFromJson(basemapConfig) {
            const basemapLayers = [];
            if (basemapConfig.layers) {
                basemapConfig.layers.forEach(layer => {
                    let basemapLayer = service.gapi.basemap.BasemapLayer({ url: layer.url });
                    basemapLayers.push(basemapLayer);
                });
            }

            const basemap = new service.gapi.basemap.Basemap({
                id: basemapConfig.id,
                layers: basemapLayers,
                title: basemapConfig.name,
                thumbnailUrl: basemapConfig.thumbnailUrl,
                wkid: basemapConfig.wkid
            });

            return basemap;
        }

        /**
        * Return a promise wrapping map creation
        */
        function buildMapPromise(initialBasemap, domNode) {

            return $q((resolve, reject) => {

                const esriMapObject = new service.gapi.mapManager.Map(domNode, {
                    basemap: initialBasemap,
                    zoom: 4,
                    center: [-100, 50]
                });

                service.gapi.events.wrapEvents(esriMapObject, {
                    load: () => {
                        // map loaded
                        resolve(esriMapObject);
                    },
                    error: () => {
                        reject('map failed to load.');
                    }
                });
            });

        }

    }
})();
