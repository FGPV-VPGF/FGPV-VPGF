/**
 * @module LayerBlueprintFactory
 * @memberof app.geo
 * @requires dependencies
 * @description
 *
 * The `LayerBlueprint` service returns `LayerBlueprint` class which abstracts common elements of layer creating (either from file or online servcie).
 * The `LayerServiceBlueprint` service returns `LayerServiceBlueprint` class to be used when creating layers from online services (supplied by config, RCS or user added).
 * The `LayerFileBlueprint` service returns `LayerFileBlueprint` class to be used when creating layers from user-supplied files.
 *
 */
angular
    .module('app.geo')
    .factory('LayerBlueprint', LayerBlueprintFactory);

function LayerBlueprintFactory($q, $http, gapiService, Geo, ConfigObject, bookmarkService, configService, layerSource) {

    let idCounter = 0; // layer counter for generating layer ids

    // destructure Geo into `layerTypes` and `serviceTypes`
    const { Layer: { Types: layerTypes }, Service: { Types: serviceTypes } } = Geo;

    class LayerBlueprint {
        /**
         * Creates a new LayerBlueprint.
         * @param  {Object} initialConfig partial config, can be an empty object.
         * @param  {Function} epsgLookup a function which takes and EPSG code and returns a projection definition (see geoService for the exact signature)
         */
        constructor() { }

        /**
         * Get the layer definition query
         *
         * @method _getFilterDefintion
         * @private
         * @param {Array} columns an array of columns of a layer
         * @return {String} the Assembled query definition of the layer
         */
        _getFilterDefintion(columns) {
            let defs = [];

            columns.forEach(column => {
                if (typeof column.filter !== 'undefined' && column.filter.type && column.filter.value) {
                    defs = this._getColumnFilterDefintion(defs, column);
                }
            });

            return defs.join(' AND ');
        }

        /**
         * Set the layer definition query
         *
         * @method _getColumnFilterDefintion
         * @private
         * @param   {Array}   defs   array of definition queries
         * @param   {Object}   column   column object
         * @return {Array} defs definition queries array
         */
        _getColumnFilterDefintion(defs, column) {
            if (column.filter.type === 'string') {
                // replace ' by '' to be able to perform the search in the datatable
                // relpace * wildcard and construct the query (add wildcard at the end)
                const val = column.filter.value.replace(/'/g, /''/);
                if (val !== '') {
                    defs.push(`UPPER(${column.data}) LIKE \'${val.replace(/\*/g, '%').toUpperCase()}%\'`);
                }
            } else if (column.filter.type === 'selector') {
                const val =  column.filter.value.join(',').replace(/"/g, '\'');
                if (val !== '') {
                    defs.push(`${column.data} IN (${val})`);
                }
            } else if (column.filter.type === 'number') {
                const values = column.filter.value.split(',');
                const min = values[0];
                const max = values[1];

                if (min !== '') {
                    defs.push(`${column.data} >= ${min}`);
                }
                if (max !== '') {
                    defs.push(`${column.data} <= ${max}`);
                }
            } else if (column.filter.type === 'date') {
                const min = column.filter.value.min;
                const max = column.filter.value.max;

                if (min) {
                    const dateMin = `${min.getMonth() + 1}/${min.getDate()}/${min.getFullYear()}`;
                    defs.push(`${column.data} >= DATE \'${dateMin}\'`);
                }
                if (max) {
                    const dateMax = `${max.getMonth() + 1}/${max.getDate()}/${max.getFullYear()}`;
                    defs.push(`${column.data} <= DATE \'${dateMax}\'`);
                }
            }
            return defs;
        }

        /**
         * Apply layer definition query on the layer node object
         *
         * @method _applyFilterQuery
         * @private
         * @param   {LayerNode}   layerSource   layer source object
         */
        _applyFilterQuery(layerSource) {
            if (layerSource.layerType === layerTypes.ESRI_DYNAMIC) {
                // walk through sub layers in dynamic layer
                for (let i = 0; i < layerSource.layerEntries.length; i++) {
                    if (layerSource.layerEntries[i].table && (layerSource.layerEntries[i].table.applyMap || layerSource.layerEntries[i].table.applied)) {
                        layerSource.layerEntries[i].initialFilteredQuery = this._getFilterDefintion(layerSource.layerEntries[i].table.columns);
                    }
                }
            } else if (layerSource.table && (layerSource.table.applyMap || layerSource.table.applied)) {
                layerSource.initialFilteredQuery = this._getFilterDefintion(layerSource.table.columns);
            }
        }

        // no validation required for services. mock a vlidation process for consistency.
        // only instances of LayerFileBlueprint required validation; that class overrides this function
        validateLayerSource() {
            return $q.resolve();
        }

        set config(value) {
            if (this._config) {
                console.warn('config is already set');
                return;
            }

            // check if there is a parsed and stored bookmark for this layer and apply if any
            if (bookmarkService.storedBookmark) {
                const bookmarkedLayer = bookmarkService.storedBookmark.bookmarkLayers.find(layer =>
                    layer.id === value.id);

                if (bookmarkedLayer) {
                    value.applyBookmark(bookmarkedLayer);
                }
            }

            this._config = value;
        }
        get config() { return this._config; }

        /**
         * @returns {Object} layer node source config object with applied defaults
         */
        get source() { return this._source; }
        set source(value) {
            if (this._source) {
                console.warn('source is already set');
                return;
            }

            this._applyFilterQuery(value);

            this._source = value;
            this.config = new LayerBlueprint.LAYER_TYPE_TO_LAYER_NODE[this._source.layerType](this._source);
        }

        /**
         * Sets layer type.
         * @param  {String} value layer type as String
         */
        set layerType(value) {
            // apply config defaults when setting layer type
            this.config.layerType = value;
            this._applyDefaults();

            // generate id if missing when generating layer
            if (typeof this.config.id === 'undefined') {
                this.config.id = `${this.layerType}#${idCounter++}`;
            }
        }

        /**
         * Generates a layer object. This is a stub function to be fully implemented by subcalasses.
         * @return {Object} "common config" ? witch contains layer id
         */
        generateLayer() {
            throw new Error('Call generateLayer on a subclass instead.');
        }

        static get LAYER_TYPE_TO_LAYER_NODE() {
            return {
                [layerTypes.ESRI_TILE]: ConfigObject.layers.BasicLayerNode,
                [layerTypes.ESRI_FEATURE]: ConfigObject.layers.FeatureLayerNode,
                [layerTypes.ESRI_IMAGE]: ConfigObject.layers.BasicLayerNode,
                [layerTypes.ESRI_DYNAMIC]: ConfigObject.layers.DynamicLayerNode,
                [layerTypes.OGC_WMS]: ConfigObject.layers.WMSLayerNode,
                [layerTypes.OGC_WFS]: ConfigObject.layers.WFSLayerNode
            }
        }

        static get LAYER_TYPE_TO_LAYER_RECORD() {
            const gapiLayer = gapiService.gapi.layer;

            return {
                [layerTypes.ESRI_TILE]: gapiLayer.createTileRecord,
                [layerTypes.ESRI_FEATURE]: gapiLayer.createFeatureRecord,
                [layerTypes.ESRI_IMAGE]: gapiLayer.createImageRecord,
                [layerTypes.ESRI_DYNAMIC]: gapiLayer.createDynamicRecord,
                [layerTypes.OGC_WMS]: gapiLayer.createWmsRecord,
                [layerTypes.OGC_WFS]: gapiLayer.createWfsRecord
            }
        }
    }

    class LayerServiceBlueprint extends LayerBlueprint {
        /**
         * Creates a new LayerServiceBlueprint.
         * @param  {Object|LayerSourceInfo} source fully-formed layer config object coming from the config file, or the layerSourceInfo object coming from thel layer loader
         */
        constructor(configFileSource = null, userAddedSource = null) {

            super();

            if (configFileSource) {
                this.source = configFileSource;
            } else if (userAddedSource) {
                this.config = userAddedSource.config;
            }

            return this.validateLayerSource().then(() => this);
        }

        /**
         * Generates a layer from an online service based on the layer type.
         * Takes a layer in the config format and generates an appropriate layer object.
         *
         * @param {Object} layerConfig a configuration fragment for a single layer
         * @return {Promise} resolving with a LayerRecord object matching one of the esri/layers objects based on the layer type
         */
        generateLayer() {
            const intentions = configService.getSync.intentions;
            const lookup = (intentions && intentions.epsg) ? intentions.epsg.lookup : undefined;

            return LayerBlueprint.LAYER_TYPE_TO_LAYER_RECORD[this.config.layerType](
                this.config, undefined, lookup);
        }
    }

    /**
     * Create a LayerFileBlueprint.
     * Retrieves data from the file. The file can be either online or local.
     * @param  {Function} epsgLookup a function which takes and EPSG code and returns a projection definition (see geoService for the exact signature)
     * @param  {Number} targetWkid wkid of the current map object
     * @param  {String} path      either file name or file url; if it's a file name, need to provide a HTML5 file object
     * @param  {File} file      optional: HTML5 file object
     * @return {Function} progressCallback        optional: function to call on progress events druing when reading file
     * @return {String}           service type: 'csv', 'shapefile', 'geojson'
     */
    class LayerFileBlueprint extends LayerBlueprint {
        constructor(configFileSource = null, userAddedSource = null) {

            super();

            if (configFileSource) {
                this.source = configFileSource;
                return layerSource.fetchServiceInfo(configFileSource.url, configFileSource.layerType)
                    .then(({ options: layerSourceOptions, preselectedIndex }) => {
                        this._layerSourceOptions = layerSourceOptions;
                        this._layerSource = layerSourceOptions[preselectedIndex];
                        this._layerSource.config._id = configFileSource.id;     // need to change id manually since id given is auto-generated from file logic
                        if (configFileSource.colour) {
                            this._layerSource.colour = configFileSource.colour; // need to also change colour manually, if provided, since colour is also auto-generated
                        }
                        if (!configFileSource.name) {
                            this.config.name = this._layerSource.config.name;
                        }
                        return this._layerSource.validate().then(() => this.validateLayerSource().then(() => this));
                    });
            } else if (userAddedSource) {
                this._layerSource = userAddedSource;
                this.config = this._layerSource.config;
                return this.validateLayerSource().then(() => this);
            }
        }

        validateLayerSource() {
            // clone data because the makeSomethingLayer functions mangle the config data
            const formattedDataCopy = angular.copy(this._layerSource.formattedData);

            // HACK: supply epsgLookup here;
            // TODO: find a better place for it
            const intentions = configService.getSync.intentions;
            const lookup = (intentions && intentions.epsg) ? intentions.epsg.lookup : undefined;
            this._layerSource.epsgLookup = lookup;

            const layerFileGenerators = {
                [Geo.Service.Types.CSV]: () =>
                    gapiService.gapi.layer.makeCsvLayer(formattedDataCopy, this._layerSource),
                [Geo.Service.Types.GeoJSON]: () =>
                    gapiService.gapi.layer.makeGeoJsonLayer(formattedDataCopy, this._layerSource),
                [Geo.Service.Types.Shapefile]: () =>
                    gapiService.gapi.layer.makeShapeLayer(formattedDataCopy, this._layerSource)
            };

            const layerPromise = layerFileGenerators[this._layerSource.type]();

            layerPromise.then(layer =>
                (this.__layer__ = layer));

            return layerPromise;
        }

        /**
         * Generate actual esri layer object from the file data, config and user options.
         * @return {Promise} promise resolving with the esri layer object
         */
        generateLayer() {
            const intentions = configService.getSync.intentions;
            const lookup = (intentions && intentions.epsg) ? intentions.epsg.lookup : undefined;

            return LayerBlueprint.LAYER_TYPE_TO_LAYER_RECORD[this.config.layerType](this.config, this.__layer__, lookup);
        }
    }

    const service = {
        buildLayer: layerSource => {
            if (layerSource.type && _isFileOrWFSLayer(layerSource)) {   // file or WFS added through importer
                return new LayerFileBlueprint(null, layerSource);
            } else if (layerSource.config) {                            // service added through importer
                return new LayerServiceBlueprint(null, layerSource);
            } else {                                                    // any file / service added through config
                switch (layerSource.layerType) {
                    case Geo.Layer.Types.OGC_WFS:
                        layerSource.type = Geo.Service.Types.GeoJSON;
                        return new LayerFileBlueprint(layerSource);
                    case Geo.Layer.Types.ESRI_GRAPHICS:
                    case Geo.Layer.Types.ESRI_DYNAMIC:
                    case Geo.Layer.Types.ESRI_IMAGE:
                    case Geo.Layer.Types.ESRI_TILE:
                    case Geo.Layer.Types.OGC_WMS:
                    case Geo.Layer.Types.ESRI_FEATURE:  // may need to split this into two, one for services and one for files
                        return new LayerServiceBlueprint(layerSource);
                    default:
                        return new LayerFileBlueprint(layerSource);
                }
            }
        }
    };

    /**
     * Checks if the layer being added is a file layer or a WFS layer based on its type.
     * @function _isFileOrWFSLayer
     * @private
     * @param {String} source a string representing the type of layer being added
     * @return {Boolean} true if the layer type matches one of the file layer constants
     */
    function _isFileOrWFSLayer(source) {
        const fileTypes = [Geo.Service.Types.CSV, Geo.Service.Types.GeoJSON, Geo.Service.Types.Shapefile];
        return (fileTypes.indexOf(source.type) !== -1);
    }

    return service;
}
