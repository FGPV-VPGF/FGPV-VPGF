(() => {
    'use strict';

    /**
     * @ngdoc service
     * @name stateManager
     * @module app.common
     * @requires
     * @description
     *
     * The `stateManager` factory is a service controlling states (true/false) of panels and their content.
     * State object corresponds to either a panel with mutually exclusive content panes, a content pane, or any other element with set content. For simplicity, a state object which is a parent, cannot be a child of another state object.
     *
     * When a parent state object is:
     * - activated: it activates a first (random) child as well; activating a parent state object should be avoided;
     * - deactivated: it deactivates its active child as well;
     *
     * When a child state object is:
     * - activated: it activates its parent and deactivates its active sibling if any;
     * - deactivated: it deactivates its parent as well;
     *
     * Only `active` and `morph` state properties are animated (animation can be skip which is indicated by the `activeSkip` and `morphSkip` flags) and need to be set through `setActive` and `setMorph` functions accordingly; these properties can be bound and watched directly though. Everything else on the `state` object can be set, bound, and watched directly.
     */
    angular
        .module('app.common.router')
        .factory('stateManager', stateManager);

    // https://github.com/johnpapa/angular-styleguide#factory-and-service-names

    function stateManager($q, $rootScope) {
        const service = {
            addState,

            setActive,
            setMorph,

            callback,

            state: {},

            // temporary place to store layer data;
            // TODO: move to the state object
            _detailsData: {
                layers: []
            }
        };

        // state object
        // sample state object
        service.state = {
            main: {
                active: false,
                activeSkip: false, // flag for skipping animation
            },
            mainToc: {
                active: false,
                activeSkip: false,
                parent: 'main'
            },
            mainToolbox: {
                active: false,
                activeSkip: false,
                parent: 'main'
            },
            mainDetails: {
                active: false,
                activeSkip: false,
                parent: 'main'
            },
            side: {
                active: false,
                activeSkip: false
            },
            sideMetadata: {
                active: false,
                activeSkip: false,
                parent: 'side'
            },
            sideSettings: {
                active: false,
                activeSkip: false,
                parent: 'side'
            },
            filters: {
                active: false,
                activeSkip: false,
                morph: 'default', // minimized, full,
                morphSkip: false,
            },
            filtersFulldata: {
                active: false,
                activeSkip: false,
                parent: 'filters'
            },
            filtersNamedata: {
                active: false,
                activeSkip: false,
                parent: 'filters'
            },
            other: {
                active: false,
                activeSkip: false
            },
            otherBasemap: {
                active: false,
                activeSkip: false,
                parent: 'other'
            },
            mapnav: {
                morph: 'default',
                morphSkip: false
            }
        };

        const fulfillStore = {}; // keeping references to promise fulfill functions

        return service;

        ///////////

        /**
         * Adds new items to the state collection with overrride;
         * @param {Array} items an array of state items
         */
        function addState(items) {
            service.state = angular.merge(service.state, items);
        }

        /**
         * Sets items states. Items may be supplied as an array of strings or ojects of `{ [itemName]: [targetValue] }` where `itemName` is a String; `targetValue`, a boolean. If the targetValue is not supplied, a negation of the current state is used. runAfter changing state of an item, stateManager waits for state directive to resolve items callback runAfter its transition is completed. This can be used to open toc panel and then metadata panel in sequence.
         *
         * ```js
         * // sideMetadata panel will only be activated when state directive resolved mainToc callback runAfter its transition is complete
         * stateManager.setActive('mainToc', 'sideMetadata');
         *
         * // same effect as above but using object notation with explicit target values
         * stateManager.setActive({ mainToc: true }, { sideMetadata: true });
         * ```
         *
         * @param {Array} items state items to toggle
         * @return {Promise} returns a promise which is resolved when animation completes; if the child is supplies as the element to be manipulated and its transition is immediate, the return promise is resovled when its parent animation is complete;
         */
        function setActive(...items) {
            if (items.length > 0) {
                let runAfter;

                let one = items.shift(); // get first item
                let oneTargetValue;

                // infer name, target state and parent
                if (typeof one === 'string') {
                    one = getItem(one);
                    oneTargetValue = !one.item.active; // using negated current state as the target
                } else {
                    let oneName = Object.keys(one)[0];
                    oneTargetValue = one[oneName];
                    one = getItem(oneName);
                }

                //console.log('Setting state item', one.name, 'to', oneTargetValue);
                if (one.item.parent) { // item has a parent

                    let oneParent = getParent(one.name); // get parent
                    if (oneTargetValue) { // item turning on

                        if (!oneParent.item.active) { // if parent is off,
                            setItemProperty(one.name, 'active', true, true); // turn item on without animation
                            one = oneParent; // and animate parent's opening transition
                        } else { // if parent is on,
                            getChildren(oneParent.name)
                                .forEach(child => {
                                    //console.log('child - ', child);
                                    if (child.name !== one.name) {
                                        setItemProperty(child.name, 'active', false); // animate siblings off
                                    }
                                });
                        }

                    } else { // item turning off
                        one = oneParent; // animate parent's closing transition
                        runAfter = () => { // runAfter parent finished its transition
                            getChildren(oneParent.name)
                                .forEach(child => {
                                    //console.log('child 1- ', child);
                                    setItemProperty(child.name, 'active', false, true); // immediately turn off all children
                                });
                        };
                    }

                } else { // item is a parent
                    let oneChildren = getChildren(one.name);

                    // when turning a parent item on, turn on first (random) child
                    if (oneTargetValue && oneChildren.length > 0) { // turning on and with children
                        setItemProperty(oneChildren[0].name, 'active', true, true); // immediately turn the first (random) child on without transition
                    } else if (!oneTargetValue) { // turning off
                        runAfter = () => { // runAfter parent finished its transition
                            oneChildren.forEach(child => {
                                //console.log('child 2- ', child);
                                setItemProperty(child.name, 'active', false, true); // immediately turn off all children
                            });
                        };
                    }
                }

                // return promise for easy promise chaining
                return setItemProperty(one.name, 'active', oneTargetValue)
                    .then(() => {

                        //console.log('Continue with the rest of state items');
                        // run any `runAfter` function if exists
                        if (runAfter) {
                            runAfter();
                        }

                        // process the rest of the items
                        return setActive(...items);
                    });
            } else {
                return $q.resolve(true); // return a resolved promise for thenability
            }
        }

        /**
         * Changes the morph value of the item to the value specified
         * @param  {String} itemName       name of the item to change
         * @param  {String} value      value to change the morph to
         * @return {Object}            the stateManager service to use for chaining
         */
        function setMorph(itemName, value) {
            setItemProperty(itemName, 'morph', value);

            return service;
        }

        /**
         * Resolves promise on the item waiting for its transition to complete.
         * @param  {String} itemName name of the state to resolve
         */
        function callback(itemName, property) {
            const fulfillKey = `${property}${itemName}`;

            //console.log('Resolving state item lock:', itemName, property, fulfillStore[fulfillKey]); //, item.fulfill);
            // there is no memory leak since there is a finite (and small) number of fulfill keys
            if (fulfillStore[fulfillKey]) {
                fulfillStore[fulfillKey]();
            }
        }

        /* PRIVATE HELPERS */

        /**
         * Sets specified item to the provided value; waits for transition to complete
         * @param {String} itemName  object name to modify
         * @param {String} property  property name to modify
         * @param {Boolean} value  target state value
         * @param {Boolean} skip skips animation, defaults to false
         */
        function setItemProperty(itemName, property, value, skip = false) {
            const item = service.state[itemName];

            return $q(fulfill => { // reject is not used
                const fulfillKey = `${property}${itemName}`; // key to store `fulfill` function
                const skipKey = `${property}Skip`; // key to store `skip` animation flag

                item[skipKey] = skip; // even if the item has proper state, set its skip value for sanity

                //console.log('settingItem', item, item.active, value);
                if (item[property] !== value) {

                    // check if fulfill function exists from before exist and resolve it
                    if (fulfillStore[fulfillKey]) {
                        fulfillStore[fulfillKey]();
                    }
                    fulfillStore[fulfillKey] = fulfill; // store fulfill function to resolve on callback

                    item[property] = value;

                    // emit event on the rootscope when change started
                    $rootScope.$broadcast('stateChangeStart', itemName, property, value, skip);

                    // waititing for items to animate and be resolved
                } else {
                    // resolve immediately
                    fulfill();
                }
            })
            .then(() => {
                //console.log('EMIT EVENT for', itemName, property, value, skip);
                // emit event on the rootscope when change is complete
                $rootScope.$broadcast('stateChangeComplete', itemName, property, value, skip);
            });
        }

        /**
         * Returns item object from itemName specified
         * @param  {String} itemName name of the item
         * @return {Object}          state object and its name
         */
        function getItem(itemName) {
            return {
                name: itemName,
                item: service.state[itemName]
            };
        }

        /**
         * Returns a parent of the itemName specified
         * @param  {String} itemName name of the state object whose parent will be returned
         * @return {Object}          state object and its name
         */
        function getParent(itemName) {
            let parentName = service.state[itemName].parent;
            let parent = service.state[parentName];

            return {
                name: parentName,
                item: parent
            };
        }

        /**
         * Returns array of children of the itemName specified
         * @param  {String} parentName itemName whose children will be returned
         * @return {Object}            an array of state objects and their names
         */
        function getChildren(parentName) {
            return Object.keys(service.state)
                .filter((key) => {
                    return service.state[key].parent === parentName;
                })
                .map((key) => {
                    return {
                        name: key,
                        item: service.state[key]
                    };
                });
        }
    }
})();
