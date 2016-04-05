(() => {
    /**
     * Dynamically injects the main viewer script and styles references.
     * TODO: need to check how viewer works if there is already a version of jQuery on the page; maybe load a jQuery-less version of the viewer then.
     * Reference on script loading: http://www.html5rocks.com/en/tutorials/speed/script-loading/
     */
    const d = document;
    const scripts = d.getElementsByTagName('script'); // get scripts

    // TODO: make more robust; this way of getting script's url might break if the `asyn` attribute is added on the script tag
    const seedUrl = scripts[scripts.length - 1].src; // get the last loaded script, which is this
    const repo = seedUrl.substring(0, seedUrl.lastIndexOf('/'));

    const headNode = d.getElementsByTagName('head')[0];
    const bodyNode = d.getElementsByTagName('body')[0];

    // inject styles
    const stylesLink = d.createElement('link');
    stylesLink.href = `${repo}/main.css`;
    stylesLink.type = 'text/css';
    stylesLink.rel = 'stylesheet';
    stylesLink.media = 'screen,print';

    headNode.appendChild(stylesLink);

    // inject fonts
    const fontsLink = d.createElement('link');
    fontsLink.href = 'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700,400italic';
    fontsLink.rel = 'stylesheet';

    headNode.appendChild(fontsLink);

    // inject jQuery if it is not already present
    if (!window.jQuery) {
        const jQScript = d.createElement('script');
        jQScript.src = 'https://code.jquery.com/jquery-2.2.1.min.js';
        jQScript.type = 'text/javascript';

        bodyNode.appendChild(jQScript);
    }

    // inject core js
    const coreScript = d.createElement('script');
    coreScript.src = `${repo}/core.js`;
    coreScript.type = 'text/javascript';

    bodyNode.appendChild(coreScript);
})();
