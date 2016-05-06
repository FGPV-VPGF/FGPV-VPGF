(() => {
    'use strict';

    /**
     * @ngdoc directive
     * @name rvShell
     * @module app.layout
     * @restrict E
     * @description
     *
     * // TODO: update comments since it's a directive now and much had changed.
     * The `ShellController` controller handles the shell which is the visible part of the layout.
     * `self.isLoading` is initially `true` and causes the loading overlay to be displayed; when `configService` resolves, it's set to `false` and the loading overly is removed.
     */
    angular
        .module('app.layout')
        .directive('rvShell', rvShell);

    function rvShell(storageService, stateManager, $rootElement) {
        const directive = {
            restrict: 'E',
            templateUrl: 'app/layout/shell.html',
            scope: {},
            link: link,
            controller: Controller,
            controllerAs: 'self',
            bindToController: true
        };

        return directive;

        /********/

        function link(scope, el) {
            storageService.panels.shell = el;

            // close all panels when escape key is pressed
            $rootElement.bind('keydown', event => {
                if (event.which === 27) {
                    scope.$apply(() => {
                        Object.keys(stateManager.state)
                            .forEach(pName => stateManager.setActive({ [pName]: false }));
                    });
                }
            });
        }
    }

    // TODO: clean; there is a lot of garbage/demo code here
    function Controller($rootElement, $mdDialog, version, sideNavigationService, geoService, fullScreenService,
        helpService) {

        'ngInject';
        const self = this;

        self.geoService = geoService;

        self.version = version;

        /***/

        // TODO: mock settings; replace by config
        self.menu = [{
                name: 'Options',
                type: 'heading',
                children: [{
                        name: 'Full Screen',
                        type: 'link',
                        action: () => {
                            sideNavigationService.close();
                            fullScreenService.toggle();
                        }
                    }, {
                        name: 'Share',
                        type: 'link'
                    }
                    /*, // TODO: re-enable if map-export functionality ever exists
                    {
                        name: 'Print',
                        type: 'link'
                    }*/
                ]
            },
            /*{ // TODO: re-enable if needed in the future
                name: 'About',
                type: 'link'
            },*/
            {
                name: 'Help',
                type: 'link',
                action: event => {
                    sideNavigationService.close();

                    // TODO: do something better
                    // open dumb help
                    $mdDialog.show({
                        controller: helpService.HelpSummaryController,
                        controllerAs: 'self',
                        templateUrl: 'app/ui/help/help-summary.html',
                        parent: $rootElement,
                        disableParentScroll: false,
                        targetEvent: event,
                        clickOutsideToClose: true,
                        fullscreen: false
                    });

                    // stateManager.setActive('help');
                    // console.log('Halp!');
                }
            }
        ];
    }
})();
