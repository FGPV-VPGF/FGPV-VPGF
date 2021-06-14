/**
 * @module mapToolService
 * @memberof app.geo
 *
 * @description
 * Provides a variety of map data for  internal or API use such as the north arrow.
 */
angular.module('app.geo').factory('mapToolService', mapToolService);

function mapToolService(configService, geoService, gapiService, $translate, Geo) {
    const service = {
        northArrow,
        mapCoordinates,
        getMapClickInfo,
        convertDDToDMS,
    };

    // get values once to reuse in private functions (cardinal points and degree symbol)
    // need to set in function because $translate.instant does not work at this point
    const cardinal = {
        deg: String.fromCharCode(176),
    };

    return service;

    /**
     * Provides data needed for the display of a north arrow on the map for lambert and mercator projections. All other projections
     * are not supported, however mapPntCntr and mapScrnCntr are still returned so that if needed, external API's can be created for
     * any projection type.
     *
     * The returned object has the following properties:
     *    projectionSupported    {boolean}   true iff current projection is lambert or mercator
     *    screenX                {Number}    left offset for arrow to intersect line between map center and north point
     *    angleDegrees           {Number}    angle derived from intersection of horizontal axis line with line between map center and north point
     *    rotationAngle          {Number}    number of degrees to rotate north arrow, 0 being none with heading due north
     *    mapPntCntr             {Object}    lat/lng of center in current extent
     *    mapScrnCntr            {Object}    pixel x,y of center in current extent
     *
     * @function  northArrow
     * @returns  {Object}    an object containing data needed for either static or moving north arrows
     */
    // eslint-disable-next-line max-statements
    function northArrow() {
        // TODO: fix after config service is done
        const map = geoService.map;
        // const map = geoService.mapObject;
        const mapPntCntr = map.extent.getCenter();
        const mapBottomY = map.extent.ymin;
        const mapScrnCntr = map.toScreen(mapPntCntr);
        const wkid = map.extent.spatialReference.wkid; // NOTE this will not support any WKT mercator things

        let screenX = null;
        let screenY = null;
        let angleDegrees = null;
        let rotationAngle = null;

        if (Geo.SpatialReference.WEB_MERCATOR.wkids.includes(wkid)) {
            // mercator
            // always in center of viewer with no rotation
            screenX = mapScrnCntr.x;
            rotationAngle = 0;
        } else {
            const shellLeftOffset = $('.rv-inner-shell').offset().left - $('rv-shell').offset().left; // offset for arrow position calculations
            const shellWidth = $('.rv-inner-shell').width() / 2; // inner shell width for min/max x calculations
            const arrowWidth = $('.rv-north-arrow').width(); // arrow width to correct arrow positioning
            const offsetX = shellLeftOffset + shellWidth - arrowWidth / 2;
            let arrowPoint = map.toMap({ x: offsetX, y: 0 });
            arrowPoint.y = mapBottomY;
            // getNorthArrowAngle uses 180 degrees as north but here we expect 90 degrees to be north, so we correct the rotation by the subtraction
            angleDegrees = 270 - map.getNorthArrowAngle({ point: arrowPoint });
            // since 90 degree is north, any deviation from this is the rotation angle
            rotationAngle = 90 - angleDegrees;
            // hard code north pole so that arrow does not continue pointing past it
            const northPoint = gapiService.gapi.proj.localProjectPoint('EPSG:4326', map.extent.spatialReference, {
                x: -96,
                y: 90,
            });
            const screenNorthPoint = map.toScreen(northPoint);
            screenY = screenNorthPoint.y;
            // if the extent is near the north pole be more precise otherwise use the original math
            // note: using the precise math would be ideal but when zooming in, the calculations make very
            // large adjustments so reverting to the old less precise math provides a better experience.
            let triangle = { x: offsetX, y: mapScrnCntr.y, m: 1 }; // original numbers
            if (screenNorthPoint.x < 2400 && screenNorthPoint.x > -1300 && -screenNorthPoint.y < 3000) {
                // more precise
                triangle.x = screenNorthPoint.x;
                triangle.y = -screenNorthPoint.y;
                triangle.m = -1;
            }
            // z is the hypotenuse line from center point to the top of the viewer. The triangle is always a right triangle
            const z = triangle.y / Math.sin(angleDegrees * 0.01745329252); // 0.01745329252 is the radian conversion
            // this would be the bottom of our triangle, the length from center to where the arrow should be placed
            screenX =
                screenY < 0
                    ? triangle.x + triangle.m * (Math.sin((90 - angleDegrees) * 0.01745329252) * z) - arrowWidth / 2
                    : screenNorthPoint.x;
            // Limit the arrow to the bounds of the inner shell
            screenX = Math.max(offsetX - shellWidth, Math.min(screenX, offsetX + shellWidth));
        }

        return {
            projectionSupported: screenX !== null,
            screenX,
            screenY,
            angleDegrees,
            rotationAngle,
            mapPntCntr,
            mapScrnCntr,
        };
    }

    function loadCardinality() {
        // separate function to reduce number of lines in mapCoordinates function.
        // get values once to reuse in private functions (cardinal points and degree symbol)
        if (typeof cardinal.east === 'undefined') {
            cardinal.east = $translate.instant('geo.coord.east');
            cardinal.west = $translate.instant('geo.coord.west');
            cardinal.north = $translate.instant('geo.coord.north');
            cardinal.south = $translate.instant('geo.coord.south');
        }
    }

    function ddFormatting(point) {
        // separate function to reduce number of lines in mapCoordinates function.
        // does rounding and negative snipping for decimal degree display
        const coord = {};
        coord.y = point.y.toFixed(5);
        coord.x = point.x.toFixed(5);
        coord.y = coord.y > 0 ? coord.y : Math.abs(coord.y);
        coord.x = coord.x < 0 ? Math.abs(coord.x) : coord.x;
        return coord;
    }

    /**
     * Provides data needed for the display of a map coordinates on the map in latitude/longitude (degree, minute, second and decimal degree) if
     * spatial reference is wkid 4326 or only show coordinates if spatial reference is different
     *
     * The returned array can contain 2 items:
     *   if spatial reference ouput = 4326 (lat/long)
     *    [0]           {String}    lat/long in degree, minute, second (N/S) | lat/long in degree, minute, second (E/W)
     *    [1]           {String}    lat/long in decimal degree (N/S)| lat/long in decimal degree (E/W)
     *   otherwise
     *    [0]           {String}    number (N/S)
     *    [1]           {String}    number (E/W)
     *
     * @function  mapCoordinates
     * @param {Object} point point in map coordinate to project and get lat/long from
     * @param {Object} outMouseSR output spatial reference object OR wkid integer to show coordinates
     * @returns  {Array}    an array containing data needed for map coordinates
     */
    function mapCoordinates(point, outMouseSR) {
        // NOTE: ideally this function would only accept spatial reference objects as a parameter.
        //       but since it's part of the legacy api, we need to continue to support the old
        //       interface of integer wkid's as well.
        const latLong = 4326;
        const fixedOutMouseSR = isNaN(outMouseSR) ? outMouseSR : { wkid: outMouseSR };
        let yLabel = '';
        let xLabel = '';
        const coordArray = [];
        let failParty = false;
        let coord;

        // project point in lat/long
        // this is to get the direction (NESW), and we can use the result if our output is also lat/long
        try {
            const coordLL = gapiService.gapi.proj.localProjectPoint(point.spatialReference, latLong, [
                point.x,
                point.y,
            ]);

            // this just messages back to older format, makes code more readable
            coord = {
                x: coordLL[0],
                y: coordLL[1],
            };

            loadCardinality();

            // get cardinality
            yLabel = coord.y > 0 ? cardinal.north : cardinal.south;
            xLabel = coord.x < 0 ? cardinal.west : cardinal.east;
        } catch (error) {
            failParty = true;
            if (fixedOutMouseSR.wkid === latLong) {
                // could not calculate point to show
                coordArray.push('');
                coordArray.push('');
            }
        }

        // format the result for display
        if (fixedOutMouseSR.wkid === latLong && !failParty) {
            // degree, minute, second
            const dmsCoords = convertDDToDMS(coord.y, coord.x);
            coordArray.push(`${dmsCoords.y} ${yLabel} | ${dmsCoords.x} ${xLabel}`);

            // decimal
            coord = ddFormatting(coord);
            coordArray.push(`${coord.y} ${yLabel} | ${coord.x} ${xLabel}`);
        } else {
            // project point if wkid was different then 4326, and different than mouse out projection
            let coordProj = [point.x, point.y];
            if (!gapiService.gapi.proj.isSpatialRefEqual(fixedOutMouseSR, point.spatialReference)) {
                coordProj = gapiService.gapi.proj.localProjectPoint(point.spatialReference, fixedOutMouseSR, coordProj);
            }
            coordArray.push(`${coordProj[1].toFixed(5)} ${yLabel}`);
            coordArray.push(`${coordProj[0].toFixed(5)} ${xLabel}`);
        }

        return coordArray;
    }

    /**
     * Provides a event to listen to map click information
     *
     * @function  getMapClickInfo
     * @param {Function} clickHandler the callback function for the event to call
     */
    function getMapClickInfo(clickHandler) {
        return gapiService.gapi.events.wrapEvents(geoService.map, {
            click: clickHandler,
        });
    }

    /**
     * Convert lat/long in decimal degree to degree, minute, second.
     *
     * @function convertDDToDMS
     * @param {Number} lat latitude value
     * @param {Number} long longitude value
     * @return {Object} object who contain lat/long in degree, minute, second
     */
    function convertDDToDMS(lat, long) {
        const dy = Math.floor(Math.abs(lat)) * (lat < 0 ? -1 : 1);
        const my = Math.floor(Math.abs((lat - dy) * 60));
        const sy = Math.round((Math.abs(lat) - Math.abs(dy) - my / 60) * 3600);

        const dx = Math.floor(Math.abs(long)) * (long < 0 ? -1 : 1);
        const mx = Math.floor(Math.abs((long - dx) * 60));
        const sx = Math.round((Math.abs(long) - Math.abs(dx) - mx / 60) * 3600);

        return {
            y: `${Math.abs(dy)}${cardinal.deg} ${padZero(my)}\' ${padZero(sy)}\"`,
            x: `${Math.abs(dx)}${cardinal.deg} ${padZero(mx)}\' ${padZero(sx)}\"`,
        };
    }

    /**
     * Pad value with leading 0 to make sure there is always 2 digits if number is below 10.
     *
     * @function padZero
     * @private
     * @param {Number} val value to pad with 0
     * @return {String} string with always 2 characters
     */
    function padZero(val) {
        return val >= 10 ? `${val}` : `0${val}`;
    }
}
