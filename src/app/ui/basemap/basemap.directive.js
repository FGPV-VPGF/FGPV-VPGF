(() => {
    'use strict';

    /**
     * @module rvBasemap
     * @memberof app.ui.basemap
     * @restrict E
     * @description
     *
     * The `rvBasemap` directive displays a basemap selector. Its template uses a content pane which is loaded into the `other` panel opening on the right side of the screen. Selector groups basemaps by projection.
     *
     */
    angular
        .module('app.ui.basemap')
        .directive('rvBasemap', rvBasemap);

    function rvBasemap() {
        const directive = {
            restrict: 'E',
            templateUrl: 'app/ui/basemap/basemap.html',
            scope: {},
            link: link,
            controller: Controller,
            controllerAs: 'self',
            bindToController: true
        };

        return directive;

        /*********/

        function link() { // scope, el, attr, ctrl) {
        }
    }

    function Controller($rootScope, $translate, events, configService, geoService, reloadService) {
        'ngInject';
        const self = this;
        self.select = select;
        self.selectedWkid = null;

        // TODO: remove this; revise when config schema is finalized
        // mocking basemap part of the config
        // self.projections = [
        //     {
        //         wkid: 3978,
        //         name: 'Lambert',
        //         items: [
        // 'http://geoappext.nrcan.gc.ca/arcgis/rest/services/BaseMaps/CBMT3978/MapServer',
        // 'http://geoappext.nrcan.gc.ca/arcgis/rest/services/BaseMaps/Simple/MapServer',
        // 'http://geoappext.nrcan.gc.ca/arcgis/rest/services/BaseMaps/CBME_CBCE_HS_RO_3978/MapServer',
        // 'http://geoappext.nrcan.gc.ca/arcgis/rest/services/BaseMaps/CBMT_CBCT_GEOM_3978/MapServer'
        //         ]
        //     },
        //     {
        //         wkid: 102100,
        //         name: 'Mercator',
        //         items: [
        // 'http://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer',
        // 'http://services.arcgisonline.com/arcgis/rest/services/World_Physical_Map/MapServer',
        // 'http://services.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer',
        // 'http://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer',
        // 'http://services.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer'
        //         ]
        //     }
        // ];

        // TODO: code needs to be updated when config schema is stable
        // check to see if config service is ready
        // FIXME: clean up vars
        var promise = configService.ready();

        // run after configService is ready
        promise.then(() => {
            // construct self.projectsions using config
            console.log('Generate basemap object for rv-map directive.');

            self.projections = [];

            let useDefaultBasemap = true;

            $rootScope.$on(events.rvReady, () => {
                configService.getCurrent().then(config => {

                    [self.projections, useDefaultBasemap] = createLists(config);

                    // FIXME add appropriate safeguards for no basemaps, if not handled by fixme above.
                    try {
                        // select first basemap so UI displays it
                        if (useDefaultBasemap) {
                            self.projections[0].items[0].selected = true;

                            self.selectedWkid = self.projections[0].items[0].wkid;
                        }

                        const projections = self.projections;

                        projections.forEach(projection => {
                            const items = projection.items;

                            items.forEach(item => {
                                item.needMapRefresh = (self.selectedWkid !== item.wkid);
                            });

                        });

                    } catch (e) {
                        // no basemaps. ignore :'D
                    }

                    self.projections.forEach(projection => {
                        // get the wkid from the first
                        const wkid = projection.items[0].wkid;

                        // add blank map
                        projection.items.push({
                            name: $translate.instant('basemap.blank.title'),
                            description: $translate.instant('basemap.blank.desc'),
                            type: 'blank',
                            id: 'blank_basemap_' + wkid,
                            url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7/',
                            wkid: wkid,
                            selected: false
                        });
                    });

                    // console.log(basemaps);
                });
            });

        });

        activate();

        /*********/

        function activate() {

        }

        /**
         * Set the basemap as selected
         * @function select
         * @param  {object} basemap basemap object
         */
        function select(basemap) {

            // un-select the previous basemap
            self.projections.forEach(projection => {
                projection.items.forEach(item => {
                    item.needMapRefresh = (basemap.wkid === item.wkid) ? false : true;
                    item.selected = false;
                });
            });

            // set the selected wkid
            self.selectedWkid = basemap.wkid;

            // set the current basemap as selected.
            basemap.selected = true;

            if (geoService.baseMapHasSameSP(basemap.id)) {

                // set the selected basemap
                geoService.selectBasemap(basemap.id);
            } else {
                console.log('-- reload map --');
                reloadService.loadNewProjection(basemap.id);
            }

        }

        /**
         * Create the lists of basemaps from the config.
         *
         * @function createLists
         * @param {Object} config   Config containing basemaps for the viewer
         * @returns {Array}         Returns the lists and the "useDefaultBasemap" flag as an array in that order
         */
        function createLists(config) {
            // FIXME: in case there is no basemaps; fall back to some default one or something
            const basemaps = config.baseMaps || [];
            const projections = [];
            let wkidArray = [];
            let useDefaultBasemap = true;

            basemaps.forEach(basemap => {

                // make new projection if not exists
                var wkid = basemap.wkid;
                var idx;

                if (wkidArray.indexOf(wkid) !== -1) {
                    console.log('in if wkidArray');
                    idx = wkidArray.indexOf(wkid);
                } else {

                    // TODO: decision needed on how we handle different type of projection,
                    // adding all of them here, or it won't be an issue if we predefine all
                    // in config.
                    projections.push({
                        wkid: wkid,
                        name: (wkid === 3978) ? 'Lambert' :
                            (wkid === 102100) ? 'Mercator' : 'Other',
                        items: []
                    });

                    wkidArray.push(wkid);

                    idx = wkidArray.indexOf(wkid);
                }

                // FIXME: move to config?
                const maxLength = 35;

                if (basemap.name.length > maxLength) {
                    basemap.name = basemap.name.substring(0, maxLength - 3) + '...';
                }

                let selected = false;

                if (config.map && config.map.initialBasemapId) {
                    if (config.map.initialBasemapId === basemap.id) {
                        selected = true;
                        useDefaultBasemap = false;

                        self.selectedWkid = basemap.wkid;
                    }
                }

                projections[idx].items.push({
                    name: basemap.name,
                    description: basemap.description,
                    type: basemap.type,
                    id: basemap.id,
                    url: basemap.layers[0].url,
                    wkid: basemap.wkid,
                    selected: selected,
                    needMapRefresh: false
                });

            });

            return [projections, useDefaultBasemap];
        }
    }
})();
