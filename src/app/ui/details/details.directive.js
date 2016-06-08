(() => {
    'use strict';
    /**
     * @ngdoc directive
     * @name rvDetails
     * @module app.ui.details
     * @restrict E
     * @description
     *
     * The `rvDetails` directive to display point data and wms query results.
     * Where are multiple data items, displays a selector list on the left side, letting the user to select the item.
     *
     */
    angular
        .module('app.ui.details')
        .directive('rvDetails', rvDetails);

    function rvDetails(stateManager) {
        const directive = {
            restrict: 'E',
            templateUrl: 'app/ui/details/details.html',
            link
        };

        return directive;

        function link(scope, element) {
            const self = scope.self;

            self.closeDetails = () => stateManager.closePanel('mainDetails');

            self.selectItem = item => {
                self.selectedItem = item;
            };

            self.display = stateManager.display.details;
            scope.$watch('self.display.data', newValue => {
                let focusableClose = element.find('.rv-content-pane button');
                if (focusableClose.length > 0) {
                    stateManager.setNextFocusable(focusableClose);
                }
                if (newValue && newValue.length > 0) {
                    // pick first point to be selected initially
                    self.selectedItem = newValue[0];
                } else {
                    self.selectedItem = null;
                }
            });
        }
    }
})();
