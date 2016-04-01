angular.element(document)
    .ready(() => {
        'use strict';
        // NOTE: let and const cannot be used in this file due to protractor problems

        // convert html collection to array:
        // https://babeljs.io/docs/learn-es2015/#math-number-string-object-apis
        var nodes = Array.from(document.getElementsByClassName('fgpv'));
        var child;

        var counter = 0;

        nodes.forEach(node => {
            if (!node.getAttribute('id')) {
                node.setAttribute('id', 'rv-app-' + counter++);
            }

            // load shell template into the node
            // we need to create an explicit child under app's root node, otherwise animation
            // doesnt' work; see this plunk: http://plnkr.co/edit/7EIM71IOwC8h1HdguIdD
            // or this one: http://plnkr.co/edit/Ds8e8d?p=preview
            child = angular.element('<rv-shell class="md-body-1">')[0];
            node.appendChild(child);

            // bootstrap each node as an Angular app
            // strictDi enforces explicit dependency names on each component: ngAnnotate should find most automatically
            // this checks for any failures; to fix a problem add 'ngInject'; to the function preamble
            angular.bootstrap(node, ['app'], {
                strictDi: true
            });
        });
    });
