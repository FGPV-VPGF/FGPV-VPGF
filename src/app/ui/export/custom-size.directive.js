(() => {
    'use strict';

    /**
     * @module rvExportCustomSize
     * @memberof app.ui
     * @restrict E
     * @description
     *
     * This directive contains the html template for setting a custom width and height for the
     * export image. It sets focus on the first input (width) whenever it is created.
     */
    angular
        .module('app.ui')
        .directive('rvExportCustomSize', rvExportCustomSize);

    function rvExportCustomSize() {
        return {
            restrict: 'E',
            templateUrl: 'app/ui/export/custom-size.html',
            link: (scope, el) => el.find('input').first().focus(true)
        };
    }
})();
