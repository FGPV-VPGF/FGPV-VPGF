(() => {
    'use strict';

    /**
     * @namespace app.ui
     * @description
     *
     * The `app.ui` module pull in all the inidividual ui modules.
     */
    // TODO: refactor to flatten the app.ui module
    angular
        .module('app.ui', [
            'app.ui.basemap',
            'app.ui.sidenav',
            'app.ui.appbar',
            'app.ui.panels',
            'app.ui.details',
            'app.ui.geosearch',
            'app.ui.toc',
            'app.ui.toolbox',
            'app.ui.metadata',
            'app.ui.mapnav',
            'app.ui.filters',
            'app.ui.common',
            'app.ui.settings',
            'app.ui.help',
            'app.ui.language',
            'app.ui.loader'
        ]);
})();
