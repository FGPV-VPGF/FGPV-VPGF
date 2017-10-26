import XY from 'api/geometry/XY';

/** Provides screen and geographic point information for most observable mouse actions. */
export class MouseEvent {
    /** Geographic point information */
    xy: XY | null;
    /** The number of pixels from the top of the viewport. */
    screenY: number;
    /** The number of pixels from the left edge of the viewport. */
    screenX: number;

    constructor(event: esriMouseEvent) {
        // mapPoint is specific to esri and is not available for all event types
        try {
            this.xy = new XY(event.mapPoint.y, event.mapPoint.x);
        } catch (e) {
            this.xy = null;
        }
<<<<<<< HEAD
        this.screenY = event.screenY;
        this.screenX = event.screenX;
=======
        this.pageY = event.pageY;
        this.pageX = event.pageX;
>>>>>>> Enable all map instance events
    }
}

/** ESRI wraps the standard mouse event with spatial data that we want to preserve. */
export interface esriMouseEvent extends MouseEvent {
    /** Decimal degrees in y,x form */
    mapPoint: {
        y: number,
        x: number
    };
}