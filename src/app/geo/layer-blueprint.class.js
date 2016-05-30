(() => {
    'use strict';

    /**
     * @ngdoc service
     * @name LayerBlueprint
     * @module app.geo
     * @requires dependencies
     * @description
     *
     * The `LayerBlueprint` service returns `LayerBlueprint` class which abstracts common elements of layer creating (either from file or online servcie).
     *
     */
    /**
     * @ngdoc service
     * @name LayerServiceBlueprint
     * @module app.geo
     * @requires dependencies
     * @description
     *
     * The `LayerServiceBlueprint` service returns `LayerServiceBlueprint` class to be used when creating layers from online services (supplied by config, RCS or user added).
     *
     */
    /**
     * @ngdoc service
     * @name LayerFileBlueprint
     * @module app.geo
     * @requires dependencies
     * @description
     *
     * The `LayerFileBlueprint` service returns `LayerFileBlueprint` class to be used when creating layers from user-supplied files.
     *
     */
    angular
        .module('app.geo')
        .factory('LayerBlueprint', LayerBlueprint)
        .factory('LayerServiceBlueprint', LayerServiceBlueprint)
        .factory('LayerFileBlueprint', LayerFileBlueprint);

    // jscs:disable requireSpacesInAnonymousFunctionExpression
    class BlueprintUserOptions {
        constructor() {
            this._layerName = '';
            this._primaryField = '';
        }

        get layerName() {
            return this._layerName;
        }

        set layerName(value) {
            this._layerName = value;
        }

        get primaryField() {
            return this._primaryField;
        }

        set primaryField(value) {
            this._primaryField = value;
        }
    }

    class FileCsvBlueprintUserOptions extends BlueprintUserOptions {
        constructor() {
            super();

            this._latfield = '';
            this._lonfield = '';
        }

        get latfield() {
            return this._latfield
        }

        set latfield(value) {
            this._latfield = value;
        }

        get longfield() {
            return this._lonfield;
        }

        set longfield(value) {
            this._lonfield = value;
        }
    }

    class FileGeoJsonBlueprintUserOptions extends BlueprintUserOptions {
        constructor() {
            super();
        }
    }

    class FileShapefileBlueprintUserOptions extends BlueprintUserOptions {
        constructor() {
            super();
        }
    }
    // jscs:disable requireSpacesInAnonymousFunctionExpression

    function LayerBlueprint(layerDefaults) {
        let idCounter = 0; // layer counter for generating layer ids

        // jscs doesn't like enhanced object notation
        // jscs:disable requireSpacesInAnonymousFunctionExpression
        class LayerBlueprint {
            /**
             * Creates a new LayerBlueprint.
             * @param  {Object} initialConfig partial config, can be an empty object.
             */
            constructor(initialConfig) {
                this.initialConfig = {};
                this.config = {};

                if (typeof initialConfig !== 'undefined') {
                    this.initialConfig = initialConfig;
                    this.config = angular.merge({}, initialConfig);
                }

                this._applyDefaults();

                this._userConfig = {};
            }

            /**
             * Applies layer defaults based on the layer type.
             */
            _applyDefaults() {
                if (this.layerType !== null) {
                    const defaults = layerDefaults[this.layerType];

                    // TODO: add defautls for wms and dynamic layerEntries
                    // this is mostly useless right now since we apply defaults in `legend-entry` service
                    this.config.options = angular.merge({}, defaults.options, this.initialConfig.options);
                    this.config.flags = angular.merge({}, defaults.flags, this.initialConfig.flags);
                }
            }

            /**
             * Returns layer type or null if not set of the blueprint.
             * @return {String|null} layer type as String or null
             */
            get layerType() {
                return (typeof this.config.layerType !== 'undefined') ? this.config.layerType : null;
            }

            /**
             * Sets layer type.
             * @param  {String} value layer type as String
             */
            set layerType(value) {
                // apply config defaults when setting layer type
                this.config.layerType = value;
                this._applyDefaults();
            }

            get userConfig() {
                return this._userConfig;
            }

            /**
             * Generates a layer object. This is a stub function to be fully implemented by subcalasses.
             * @return {Object} "common config" ? witch contains layer id
             */
            generateLayer() {
                // TODO: replace with a throw function
                // TODO: move id generation to where the config is bound initially
                // generate id if missing when generating layer
                if (typeof this.config.id === 'undefined') {
                    this.config.id = `${this.layerType}#${idCounter++}`;

                    // TODO: "temporary" workaround
                    this.initialConfig.id = this.config.id;
                }

                // return common config, eh...
                return {
                    id: this.config.id
                };
            }
        }
        // jscs:enable requireSpacesInAnonymousFunctionExpression

        return LayerBlueprint;
    }

    function LayerServiceBlueprint($q, LayerBlueprint, gapiService, Geo) {
        // generator functions for different layer types
        const layerServiceGenerators = {
            [Geo.Layer.Types.ESRI_DYNAMIC]: (config, commonConfig) =>
                new gapiService.gapi.layer.ArcGISDynamicMapServiceLayer(config.url, commonConfig),

            [Geo.Layer.Types.ESRI_FEATURE]: (config, commonConfig) => {
                commonConfig.mode = config.snapshot ?
                    gapiService.gapi.layer.FeatureLayer.MODE_SNAPSHOT :
                    gapiService.gapi.layer.FeatureLayer.MODE_ONDEMAND;
                return new gapiService.gapi.layer.FeatureLayer(config.url, commonConfig);
            },

            [Geo.Layer.Types.ESRI_IMAGE]: (config, commonConfig) =>
                new gapiService.gapi.layer.ArcGISImageServiceLayer(config.url, commonConfig),

            [Geo.Layer.Types.ESRI_TILE]: (config, commonConfig) =>
                new gapiService.gapi.layer.TileLayer(config.url, commonConfig),

            [Geo.Layer.Types.OGC_WMS]: (config, commonConfig) => {
                commonConfig.visibleLayers = config.layerEntries.map(le => le.id);
                return new gapiService.gapi.layer.ogc.WmsLayer(config.url, commonConfig);
            }
        };

        // jscs doesn't like enhanced object notation
        // jscs:disable requireSpacesInAnonymousFunctionExpression
        class LayerServiceBlueprint extends LayerBlueprint {
            /**
             * Creates a new LayerServiceBlueprint.
             * @param  {initialConfig} initialConfig partical config, __must__ contain a service `url`.
             */
            constructor(initialConfig) {
                if (typeof initialConfig.url === 'undefined') {
                    // TODO: throw error ?
                    console.error('Service layer needs a url.');
                    return;
                } else {
                    // `replace` strips trailing slashes
                    initialConfig.url = initialConfig.url.replace(/\/+$/, '');
                }

                super(initialConfig);

                // if layerType is no specified, this is likely a user added layer
                // call geoApi to predict its type
                if (this.layerType === null) {
                    return gapiService.gapi.layer.predictLayerUrl(this.config.url)
                        .then(fileInfo => fileInfo.serviceType)
                        .catch(error => console.error('Something happened', error));
                }
            }

            /**
             * Generates a layer from an online service based on the layer type.
             * Takes a layer in the config format and generates an appropriate layer object.
             * @param {Object} layerConfig a configuration fragment for a single layer
             * @return {Promise} resolving with a layer object matching one of the esri/layers objects based on the layer type
             */
            generateLayer() {
                const commonConfig = super.generateLayer();

                if (layerServiceGenerators.hasOwnProperty(this.layerType)) {
                    return $q.resolve(layerServiceGenerators[this.layerType](this.config, commonConfig));
                } else {
                    throw new Error('The layer type is not supported');
                }
            }
        }
        // jscs:enable requireSpacesInAnonymousFunctionExpression

        return LayerServiceBlueprint;
    }

    function LayerFileBlueprint($q, LayerBlueprint, gapiService, geoService) {
        // // FIXME:
        // // FIXME:
        // // FIXME:
        // // FIXME: This function doesn't belong here!
        // // FIXME:
        // // FIXME:
        // // FIXME:
        // jscs:disable maximumLineLength
        function epsgLookup(code) {
            console.log('imma searchin for ' + code);
            return $q(resolve => {
                // bring for the funtime lol switch
                var defst = null;
                switch (code) {
                case 'EPSG:102100':
                    console.log('I FOUND A MAPJECTION');
                    defst =
                        '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs';
                    break;

                case 'EPSG:3978':
                    defst =
                        '+proj=lcc +lat_1=49 +lat_2=77 +lat_0=49 +lon_0=-95 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
                    break;

                case 'EPSG:3979':
                    defst =
                        '+proj=lcc +lat_1=49 +lat_2=77 +lat_0=49 +lon_0=-95 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
                    break;

                case 'EPSG:54004':
                    defst =
                        '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs';
                    break;
                }

                resolve(defst);
            });
        }
        // jscs:enable maximumLineLength



        /*const USER_CONFIG = {
            [gapiService.gapi.layer.serviceType.CSV]: FileCsvBlueprintUserOptions,
            [gapiService.gapi.layer.serviceType.GeoJSON]: FileGeoJsonBlueprintUserOptions,
            [gapiService.gapi.layer.serviceType.Shapefile]: FileShapefileBlueprintUserOptions
        };*/
        // TODO: get file service types from geoapi
        const USER_CONFIG = {
            csv: FileCsvBlueprintUserOptions,
            geojosn: FileGeoJsonBlueprintUserOptions,
            shapefile: FileShapefileBlueprintUserOptions
        };

        // jscs doesn't like enhanced object notation
        // jscs:disable requireSpacesInAnonymousFunctionExpression
        /**
         * Createa a LayerFileBlueprint.
         * Retrieves data from the file. The file can be either online or local.
         * @param  {String} path      either file name or file url; if it's a file name, need to provide a HTML5 file object
         * @param  {File} file      optional: HTML5 file object
         * @param  {String} extension optional: file extension ??
         * @return {String}           service type: 'csv', 'shapefile', 'geojosn'
         */
        class LayerFileBlueprint extends LayerBlueprint {
            constructor(path, file) { // , extension) {
                super();

                this._fileData = null;
                this._formatedFileData = null;

                // empty blueprint is not valid by default
                this._validPromise = $q.reject();

                this._constructorPromise = gapiService.gapi.layer.predictLayerUrl(path)
                    .then(fileInfo => {
                        // fileData is returned only if path is a url; if it's just a file name, only serviceType is returned                            this.fileData = fileInfo.fileData;
                        this.layerType = 'esriFeature';
                        this.fileType = fileInfo.serviceType;

                        if (typeof file !== 'undefined') {
                            // if there is file object, read it and store the data
                            return this._readFileData(file)
                                .then(fileData => this._fileData = fileData);
                        } else if (typeof fileInfo.fileData !== 'undefined') {
                            this._fileData = fileInfo.fileData;
                            return undefined;
                        } else {
                            throw new Error('Cannot retrieve file data');
                        }
                    });
            }

            get fileType() {
                return this._fileType;
            }

            set fileType(value) {
                this._fileType = value;
                this._validPromise = this._constructorPromise
                    .then(() => gapiService.gapi.layer.validateFile(this.fileType, this._fileData))
                    .then(result => {
                        this._userConfig = new FileCsvBlueprintUserOptions;
                        this._formatedFileData = result;
                    })
                    .catch(error => console.error(error));
            }

            get valid() {
                return this._validPromise;
            }

            get ready() {
                return this._constructorPromise;
            }

            get fields() {
                console.log(this._formatedFileData);

                return this._formatedFileData.fields;
            }

            /**
             * Reads HTML5 File object data.
             * @private
             * @param  {File} file [description]
             * @return {Promise}      promise resolving with file's data
             */
            _readFileData(file) {
                const dataPromise = $q((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = event => {
                        console.error('Failed to read a file', event);
                        reject('Failed to read a file');
                    };
                    reader.onload = event => {
                        console.log(event, reader.result);
                        // this.fileData = reader.result ??
                        resolve(reader.result); // ???
                    };

                    reader.readAsArrayBuffer(file);
                });

                return dataPromise;
            }

            generateLayer(options) {
                const commonConfig = super.generateLayer();
                angular.extend(commonConfig, this.userConfig, {
                    layerId: commonConfig.id,
                    epsgLookup: epsgLookup, // FIXME:
                    targetWkid: geoService.mapObject.spatialReference.wkid
                });

                this.config.name = this.userConfig.layerName;

                console.log(commonConfig);

                return gapiService.gapi.layer.makeCsvLayer(this._formatedFileData.formattedData, commonConfig);
            }
        }
        // jscs:enable requireSpacesInAnonymousFunctionExpression

        return LayerFileBlueprint;
    }
})();
