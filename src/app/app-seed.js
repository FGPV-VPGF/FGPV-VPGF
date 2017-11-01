const appIdCounter = 0;

angular.element(document).ready(() => window.RV._nodes.forEach(seeder));

export function seeder(node) {
    // load shell template into the node
    // we need to create an explicit child under app's root node, otherwise animation
    // doesn't work; see this plunk: http://plnkr.co/edit/7EIM71IOwC8h1HdguIdD
    // or this one: http://plnkr.co/edit/Ds8e8d?p=preview
    node.appendChild(angular.element('<rv-shell class="md-body-1">')[0]);

    // bootstrap each node as an Angular app
    // strictDi enforces explicit dependency names on each component: ngAnnotate should find most automatically
    // this checks for any failures; to fix a problem add 'ngInject'; to the function preamble
    angular.bootstrap(node, ['app'], {
        strictDi: true
    });

    // only do this if there is another version present - protractor needs angular reference otherwise
    if (existingWindowDotAngular) {
        delete window.angular;
        window.angular = existingWindowDotAngular;
    }
}
