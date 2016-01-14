(() => {
    'use strict';

    /**
     * @ngdoc directive
     * @name rvAppbar
     * @module app.ui.appbar
     * @restrict E
     * @description
     *
     * The `rvAppbar` directive wraps and adds functionality to the menu buttons.
     *
     */
    angular
        .module('app.ui.appbar')
        .directive('rvAppbar', rvAppbar);

    /**
     * `rvAppbar` directive body.
     *
     * @return {object} directive body
     */
    function rvAppbar() {
        const directive = {
            restrict: 'E',
            templateUrl: 'app/ui/appbar/appbar.html',
            scope: {},
            controller: Controller,
            controllerAs: 'self',
            bindToController: true
        };

        return directive;
    }

    function Controller(layoutService, stateManager) {
        'ngInject';
        const self = this;

        self.layoutService = layoutService;
        self.stateManager = stateManager;

        self.toggleDetails = toggleDetails;
        self.toggleToc = toggleToc;
        self.toggleToolbox = toggleToolbox;

        activate();

        function activate() {

        }

        function toggleDetails() {
            stateManager.setActive({ side: false }, 'mainDetails');
        }

        function toggleToc() {
            stateManager.setActive({ side: false }, 'mainToc');
        }

        function toggleToolbox() {
            stateManager.setActive({ side: false }, 'mainToolbox');
        }
    }
})();
