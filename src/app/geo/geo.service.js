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

    function geoService(layerTypes) {

        //TODO update how the layerOrder works with the UI
        //Make the property read only. All angular bindings will be a one-way binding to read the state of layerOrder
        //Add a function to update the layer order. This function will raise a change event so other interested
        //pieces of code can react to the change in the order

        const service = {
            layers: {},
            layerOrder: [],
            buildMap,
            getFormattedAttributes,
            registerLayer,
            registerAttributes,
            setZoom,
            shiftZoom,
            selectBasemap
        };

        let map = null; // keep map reference local to geoService

        let mapManager = null;

        // FIXME: need to find a way to have the dojo URL set by the config
        service.promise = geoapi('http://js.arcgis.com/3.14/', window)
            .then(initializedGeoApi => service.gapi = initializedGeoApi);

        return service;

        /**
         * Adds a layer object to the layers registry
         * @param {object} layer the API layer object
         * @param {object} config a configuration fragment used to generate the layer
         * @param {object} attribs an optional object containing the attributes associated with the layer
         * @param {number} position an optional index indicating at which position the layer was added to the map
         * (if supplied it is the caller's responsibility to make sure the layer is added in the correct location)
         */
        function registerLayer(layer, config, attribs, position) {
            //TODO determine the proper docstrings for a non-service function that lives in a service

            if (!layer.id) {
                //TODO replace with proper error handling mechanism
                console.error('Attempt to register layer without id property');
                console.log(layer);
                console.log(config);
            }

            if (service.layers[layer.id]) {
                //TODO replace with proper error handling mechanism
                console.log('Error: attempt to register layer already registered.  id: ' + layer.id);
            }

            //TODO should attribs be defined and set to null, or simply omitted from the object?  some layers will not have attributes. others will be added after they load
            let l = {
                layer
            };
            if (config) {
                l.state = config;
            }
            if (attribs) {
                l.attribs = attribs;
            }
            service.layers[layer.id] = l;

            if (position === undefined) {
                position = service.layerOrder.length;
            }
            service.layerOrder.splice(position, 0, layer.id);
        }

        /**
         * Adds an attribute dataset to the layers registry
         * @param  {object} attribData an attribute dataset
         */
        function registerAttributes(attribData) {
            //TODO determine the proper docstrings for a non-service function that lives in a service

            if (!attribData.layerId) {
                //TODO replace with proper error handling mechanism
                console.log('Error: attempt to register attribute dataset without layerId property');
            }

            if (!service.layers[attribData.layerId]) {
                //TODO replace with proper error handling mechanism
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
            Object.keys(first.attributes).forEach((key, index) => {
                columns[index] = { title: key };
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
         * @return {object} a layer object matching one of the esri/layers objects based on the layer type
         */
        function generateLayer(layerConfig) {
            const handlers = {};
            const commonConfig = {
                id: layerConfig.id
            };

            handlers[layerTypes.esriDynamic] = config => {
                return new service.gapi.layer.ArcGISDynamicMapServiceLayer(config.url, commonConfig);
            };
            handlers[layerTypes.esriFeature] = config => {
                return new service.gapi.layer.FeatureLayer(config.url, commonConfig);
            };
            handlers[layerTypes.esriImage] = config => {

                // FIXME don't hardcode opacity
                commonConfig.opacity = 0.3;
                return new service.gapi.layer.ArcGISImageServiceLayer(config.url, commonConfig);
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
         * Constructs a map on the given DOM node.
         * @param {object} domNode the DOM node on which the map should be initialized
         * @param {object} config the map configuration based on the configuration schema
         */
        function buildMap(domNode, config) {

            // FIXME remove the hardcoded settings when we have code which does this properly
            map = service.gapi.mapManager.Map(domNode, { basemap: 'gray', zoom: 6, center: [-100, 50] });
            if (config.services && config.services.proxyUrl) {
                service.gapi.mapManager.setProxy(config.services.proxyUrl);
            }
            config.layers.forEach(layerConfig => {
                const l = generateLayer(layerConfig);
                map.addLayer(l);

                // wait for layer to load before registering
                // TODO: replace with geoApi event once support is there (and re-enable test)
                l.on('load', () => {
                    registerLayer(l, layerConfig);

                    // get the attributes for the layer
                    const a = service.gapi.attribs.loadLayerAttribs(l);

                    // TODO: leave a promise in the layer object that resolves when the attributes are loaded/registered
                    a.then(
                        data => {
                            registerAttributes(data);
                        })
                        .catch(
                            exception => {
                                console.log('Error getting attributes for ' + l.name + ': ' + exception);
                            });
                });
            });

            // setup map using configs
            mapManager = service.gapi.mapManager.setupMap(map, config);

            // FIXME temp link for debugging
            window.FGPV = service.layers;
        }

        /**
         * Switch basemap based on the uid provided.
         * @param {string} uid identifier for a specific basemap layerbower
         */
        function selectBasemap(uid) {
            if (typeof (mapManager) === 'undefined') {
                console.log('Error: Map manager is not setup, please setup map manager by calling setupMap().');
            } else {
                mapManager.BasemapControl.setBasemap(uid);
            }
        }

        /**
         * Sets zoom level of the map to the specified level
         * @param {number} value a zoom level number
         */
        function setZoom(value) {
            if (map) {
                map.setZoom(value);
            } else {
                console.warn('GeoService: map is not yet created.');
            }
        }

        /**
         * Changes the zoom level by the specified value relative to the current level; can be negative
         * @param  {number} byValue a number of zoom levels to shift by
         */
        function shiftZoom(byValue) {
            if (map) {
                let newValue = map.getZoom() + byValue;
                map.setZoom(newValue);
            } else {
                console.warn('GeoService: map is not yet created.');
            }

        }
    }
})();
