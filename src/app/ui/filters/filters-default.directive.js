(() => {
    // jscs:disable maximumLineLength
    let ZOOM_TO_ICON;
    const DETAILS_ICON = tooltip => `<md-icon class="rv-icon rv-description" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fit="" height="100%" width="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g id="description"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"></path></g></svg><md-tooltip role="tooltip"><div class="md-content md-show"><span>${tooltip}</span></div></md-tooltip></md-icon>`;
    // jscs:enable maximumLineLength

    /**
     * @ngdoc directive
     * @name rvFiltersDefault
     * @module app.ui.filters
     * @description
     *
     * The `rvFiltersDefault` directive is a filters and datatable panel component.
     *
     */
    angular
        .module('app.ui.filters')
        .directive('rvFiltersDefault', rvFiltersDefault);

    /**
     * `rvFiltersDefault` directive displays the datatable with layer data.
     *
     * @return {object} directive body
     */
    function rvFiltersDefault($timeout, $q, stateManager, $compile, geoService, $translate, layoutService) {
        const directive = {
            restrict: 'E',
            templateUrl: 'app/ui/filters/filters-default.html',
            scope: {},
            link,
            controller: Controller,
            controllerAs: 'self',
            bindToController: true
        };

        return directive;

        /**
         * Add a `createTable` to self. The table, after creation, is assigned to `self.table`.
         * @param  {Object} scope directive scope
         * @param  {Object} el    node element
         */
        function link(scope, el) { // scope, el, attr, ctrl) {
            const self = scope.self;
            let containerNode;

            self.createTable = createTable;
            self.destroyTable = destroyTable;

            layoutService.panes.filter = el;

            /**
             * Creates a new datatables instance (destroying existing if any). It pulls the data from the stateManager display store.
             */
            function createTable() {
                let zoomText = $translate.instant('filter.tooltip.zoom');
                const descriptionsText = $translate.instant('filter.tooltip.description');

                // TODO: move hardcoded stuff in consts
                containerNode = containerNode || el.find('.rv-filters-data-container');
                self.destroyTable();

                const requester = stateManager.display.filters.requester;
                const displayData = stateManager.display.filters.data;

                // jscs:disable maximumLineLength
                if (!geoService.validateProj(geoService.layers[requester.layerId]._layer.spatialReference)) {
                    ZOOM_TO_ICON = tooltip => `<md-icon class="rv-zoom-to disabled" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fit="" height="100%" width="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g id="zoom_in"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></g></svg><md-tooltip role="tooltip"><div class="md-content md-show"><span>${tooltip}</span></div></md-tooltip></md-icon>`;
                    zoomText = $translate.instant('filter.tooltip.nozoom');
                } else {
                    ZOOM_TO_ICON = tooltip => `<md-icon class="rv-icon rv-zoom-to" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fit="" height="100%" width="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><g id="zoom_in"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></g></svg><md-tooltip role="tooltip"><div class="md-content md-show"><span>${tooltip}</span></div></md-tooltip></md-icon>`;
                }
                // jscs:enable maximumLineLength

                // forced delay of a 100 to prevent the loading indicator from flickering if the table is created too fast; it's annoying; it means that switching tables takes at least 100ms no matter how small the table is; in majority of cases it should take more than 100ms to get data and create a table anyway;
                const forcedDelay = $q(fulfill =>
                    $timeout(() => fulfill(), 100)
                );

                // create a new table node
                const tableNode = angular.element('<table class="display nowrap rv-data-table"></table>');
                containerNode.append(tableNode);

                // add symbol as the first column
                // TODO: formatLayerAttributes function should figure out icon and store it in the attribute bundle
                if (!displayData.rows[0].hasOwnProperty('rvSymbol')) {
                    displayData.rows.forEach((row, index) => {
                        const objId = row[displayData.oidField];
                        const renderer = displayData.renderer;
                        const legend = requester.legendEntry.symbology;

                        // FIXME: mock fdata object for this particular item
                        // This will likely change with the new symbology generator
                        const fData = {
                            features: {
                                [index]: {
                                    attributes: row
                                }
                            },
                            oidIndex: {
                                [objId]: index
                            }
                        };

                        let symbol = geoService.retrieveSymbol(objId, fData, renderer, legend);
                        if (!symbol) {
                            // jscs:disable maximumLineLength
                            // TODO: have geoApi symbology detect and set empty gifs
                            symbol = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                            // jscs:enable maximumLineLength
                        }
                        row.rvSymbol = `<div class="rv-wrapper rv-symbol"><img src="${symbol}" /></div>`;
                    });

                    displayData.columns.unshift({
                        data: 'rvSymbol',
                        title: '',
                        orderable: false
                    });
                }

                // TODO: try to compile an angular compoent and insert that instead maybe with a normal click handler ???
                // FIXME: turn this into a real button for keyboard accessibility
                // get the first column after the symbol column
                const interactiveColumn = displayData.columns.find(column =>
                    column.data !== 'rvSymbol');
                addColumnInteractivity(interactiveColumn, [ZOOM_TO_ICON(zoomText), DETAILS_ICON(descriptionsText)]);

                // ~~I hate DataTables~~ Datatables are cool!
                self.table = tableNode
                    .on('init.dt', () => {
                        // turn off loading indicator after the table initialized or the forced delay whichever takes longer; cancel loading timeout as well
                        forcedDelay.then(() => {
                            // TODO: these ought to be moved to a helper function in displayManager
                            stateManager.display.filters.isLoading = false;
                            $timeout.cancel(stateManager.display.filters.loadingTimeout);
                        });
                    })
                    .DataTable({
                        dom: 'rti',
                        columns: displayData.columns,
                        data: displayData.rows,
                        order: [],
                        deferRender: true,
                        scrollY: true, // allow vertical scroller
                        scrollX: true, // allow horizontal scroller
                        autoWidth: false, // without autoWidth, few columns will be stretched to fill avaialbe width, and many columns will cause the table to scroll horizontally
                        scroller: {
                            displayBuffer: 3 // we tend to have fat tables which are hard to draw -> use small buffer https://datatables.net/reference/option/scroller.displayBuffer
                        }, // turn on virtual scroller extension
                        /*select: true,*/ // allow row select,
                        buttons: [
                            // 'excelHtml5',
                            // 'pdfHtml5',
                            {
                                extend: 'print',
                                title: self.display.requester.name
                            },
                            {
                                extend: 'csvHtml5',
                                title: self.display.requester.name
                            },
                        ]
                    });

                self.table.on('click', 'md-icon.rv-zoom-to', event => {
                    const tr = $(event.target).closest('tr');
                    const layerName = requester.name;
                    const row = self.table.row(tr);

                    // get object id from row data
                    const objId = row.data()[displayData.oidField];
                    // FIXME _layer reference
                    const layer = geoService.layers[requester.layerId]._layer;

                    geoService.zoomToGraphic(layer, layerName, objId);
                });

                self.table.on('click', 'md-icon.rv-description', event => {
                    const tr = $(event.target).closest('tr');
                    const row = self.table.row(tr);

                    // get object id from row data
                    const objId = row.data()[displayData.oidField];
                    const detailsObj = {
                        isLoading: false,
                        data: [
                            {
                                name: geoService.getFeatureName(row.data(), {}, objId),
                                data: geoService.attributesToDetails(row.data(), displayData.fields)
                            }
                        ],
                        requestId: -1,
                        requester: {
                            format: 'EsriFeature',
                            name: requester.name
                        }
                    };

                    const details = {
                        data: [detailsObj]
                    };

                    stateManager.toggleDisplayPanel('mainDetails', details, {}, 0);
                });
            }

            /**
             * Destroys the table and its node if it exists.
             */
            function destroyTable() {
                if (self.table) {
                    // destroy table with all events
                    self.table.destroy(true); // https://datatables.net/reference/api/destroy()
                    delete self.table; // kill the reference
                }
            }

            // TODO: add details button
            /**
             * Adds zoom and details buttons to the column provided.
             * @param {Object} column from the formatted attributes bundle
             */
            function addColumnInteractivity(column, icons) {
                // use render function to augment button to displayed data when the table is rendered
                column.render = data => {
                    return `<div class="rv-wrapper rv-icon-16"><span class="rv-data">${data}</span>
                        ${icons.join('')}</div>`;
                };
            }
        }
    }

    /**
     * Controller watches for panel morph changes and redraws the table after the change is complete;
     * it also watches for dispaly data changes and re-creates the table when it does change.
     */
    function Controller($scope, $timeout, tocService, stateManager, events) {
        'ngInject';
        const self = this;

        self.display = stateManager.display.filters;

        self.draw = draw;

        let isFullyOpen = false; // flag inicating that filters panel fully opened
        let deferredAction = null; // deferred function to create a table

        activate();

        function activate() {
            // wait for morph on filters panel to complete and redraw the datatable
            $scope.$on('stateChangeComplete', (event, name, property, value) => { // , skip) => {
                if (name === 'filters') {
                    console.log('Filters: ', event, name, property, value); // , skip);
                    self.draw(value);

                    if (property === 'active') {
                        isFullyOpen = value;

                        if (value && deferredAction) { // if fully opened and table creation was deferred, call it
                            deferredAction.call();
                            deferredAction = null;
                        }
                    }
                }
            });

            // watch filters data for changes; recreate table when data changes
            $scope.$watch('self.display.data', newValue => {
                if (newValue && newValue.rows) {
                    // console.log('Filters fullyOpen', isFullyOpen, self.display.isLoading);
                    // console.log('Filters: table data udpated', newValue);
                    if (isFullyOpen) {
                        self.createTable();
                    } else {
                        // we have to deferr table creating until after the panel fully opens, we if try to create the table while the animation is in progress, it freezes as all calculations that Datatables is doing blocks ui;
                        // this means when the panel first opens, it will take 300ms longer to display any table then upon subsequent table creation when the panel is already open and the user just switches between layers;
                        deferredAction = () => self.createTable();
                    }
                } else {
                    // destory table is data is set to null
                    self.destroyTable();
                }
            });

            // wait for print event and print the table
            $scope.$on(events.rvDataPrint, () => {
                console.log('Printing Datatable');

                triggerTableButton(0);
            });

            // wait for data export CSV event and export
            $scope.$on(events.rvDataExportCSV, () => {
                console.log('Exporting CSV Datatable');

                triggerTableButton(1);
            });
        }

        // re draw the table using scroller extension
        function draw(value) {
            if (self.table) {
                console.log('Filters: drawing table');

                const scroll = self.table.scroller;
                if (value === 'default') {
                    // if scroll down to the bottom of the datatable and switch view from full to default,
                    // scroller.measure() creates blank out when redraw, set measure argument to false
                    scroll.measure(false);

                    // because of no redraw datatable info does not update, set info manually
                    // TODO: make sure it works for French translation as well
                    const info = self.table.containers()[0].getElementsByClassName('dataTables_info')[0];
                    const infos = info.innerText.split(' ');
                    infos[1] = scroll.page().start + 1;
                    infos[3] = scroll.page().end + 1;
                    info.innerText = infos.join(' ');
                } else if (value === 'full') {
                    // if scroll down to the bottom of the datatable, then up a little bit and switch view from default to full,
                    // scroller.measure(false) creates blank out when redraw, set measure argument to true
                    scroll.measure(true);
                }

                // self.table.columns.adjust().draw();
            }
        }

        /**
         * Triggers a button on the table with the specified index
         * @param  {Number|String} index button selector: https://datatables.net/reference/api/button()
         */
        function triggerTableButton(index) {
            const button = self.table.button(index);
            if (button) {
                button.trigger();
            }
        }
    }
})();
