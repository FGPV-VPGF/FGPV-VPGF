/* global bard, $compile, $rootScope */

describe('rvMorph', () => {
    let scope;
    let directiveElement;

    beforeEach(() => {
        // mock the module with bardjs
        bard.appModule('app.ui.common');

        // inject angular services
        bard.inject('$compile', '$rootScope');

        // crete new scope
        scope = $rootScope.$new();
        scope.self = {
            mode: 'classZero'
        };

        // create new element; set morph speed to 0 to speed up tests
        directiveElement = $compile(angular.element(
                '<div rv-morph="self.mode" rv-morph-speed="0"></div>'))
            (scope);
        scope.$digest();
    });

    describe('rvMorph', () => {
        it('should be created successfully', () => {
            // check that directive element exists
            expect(directiveElement)
                .toBeDefined();

            // check that directive attribute value is set correctly
            expect(directiveElement.attr('rv-morph'))
                .toEqual('self.mode');
        });

        it('should change class name', done => {
            // check if the initial class is set correctly with no delay
            expect(directiveElement.hasClass('classZero'))
                .toBe(true);

            // change morph value
            scope.self.mode = 'classOne';
            scope.$digest();

            // use small timeout since even zero-length animation is async
            setTimeout(() => {
                expect(directiveElement.hasClass('classOne'))
                    .toBe(true);
                done();
            }, 50);
        });
    });
});
