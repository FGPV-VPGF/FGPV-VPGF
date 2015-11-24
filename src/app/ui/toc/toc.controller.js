(() => {
    'use strict';

    /**
     * @ngdoc function
     * @name TocController
     * @module app.ui.toc
     * @description
     *
     * The `TocController` controller handles the layer selector (or toc) main panel.
     * Right now it's hacked together for demo purposes.
     * `TocController` has lots of ugly code to handle state switching. Should be rewritten.
     */
    angular
        .module('app.ui.toc')
        .controller('TocController', TocController);

    function TocController($state, tocService) {
        const self = this;

        self.toggleFilters = toggleFilters;
        self.toggleFiltersFull = toggleFiltersFull;

        self.config = tocService.data;
        self.presets = tocService.presets;

        // temp function to open layer groups
        self.toggleGroup = group => {
            console.log('toggle group', group.name);
            group.expanded = !group.expanded;
        };

        activate();

        ///////////////

        // hacky way to toggle panels;
        // TODO: replace with a sane methods
        function toggleFilters() {
            if ($state.current.name.indexOf('filters') === -1) {
                $state.go('app.main.toc.filters.default', {}, {
                    location: false
                });
            } else {
                $state.go('app.main.toc', {}, {
                    location: false
                });
            }
        }

        // hacky way to toggle filters panel modes;
        // TODO: replace with a sane methods
        function toggleFiltersFull() {
            const views = [
                'app.main.toc.filters.default',
                'app.main.toc.filters.default.minimized',
                'app.main.toc.filters.default.full',
                'app.main.toc.filters.default.attached'
            ];

            let index = (views.indexOf($state.current.name) + 1) % 4;

            $state.go(views[index], {}, {
                location: false
            });
        }

        function activate() {

        }
    }
})();
