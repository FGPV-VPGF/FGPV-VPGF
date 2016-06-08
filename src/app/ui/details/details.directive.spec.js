/* global bard, $compile, $rootScope */

describe('rvDetails', () => {
    let scope;
    let directiveScope; // needed since directive requests an isolated scope
    let directiveElement;

    beforeEach(() => {
        // mock the module with bardjs; include templates modules
        bard.appModule('app.ui.details', 'app.templates', 'app.common.router', 'pascalprecht.translate');

        // inject angular services
        bard.inject('$compile', '$rootScope');

        // crete new scope
        scope = $rootScope.$new();

        directiveElement = angular.element(
            '<rv-details></rv-details>'
        );

        directiveElement = $compile(directiveElement)(scope);
        scope.$digest();

        // get isolated scope from the directive created;
        // http://stackoverflow.com/a/20312653
        directiveScope = directiveElement.isolateScope();
    });

});
