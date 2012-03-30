define(["dojo/_base/declare",
        "bf/XFormsProcessor",
        "bf/ClientServerEvent",
        "dojo/behavior",
        "bf/ControlBehavior",
        "bf/OutputBehavior",
        "bf/InputBehavior",
        "bf/TriggerBehavior",
        "dojo/dom",
        "dojo/query",
        "dojo/dom-class",
        "dojo/_base/window",
        "dojo/dom-style",
        "dojo/dom-attr",
        "dojo/_base/connect",
        "dojo/_base/lang",
        "dojo/domReady!"], function(declare, XFormsProcessor,ClientServerEvent,
                                    behavior, ControlBehavior, OutputBehavior, InputBehavior,TriggerBehavior,
                                    dom,query,domClass,win,domStyle,domAttr,connect,lang){
    return declare("bf.XFProcessor",XFormsProcessor, {

/**
 All Rights Reserved.
 @author Joern Turner
 @author Lars Windauer

 This class represents the interface to the remote XForms processor (aka 'betterForm Web') with DWR. It is the only class
 actually having dependency on DWR to handle the AJAX part of things and calling remote Java methods on
 de.betterform.web.betterform.FluxFacade.
 **/

    sessionKey:"",
    dataPrefix:"",
    skipshutdown:false,
    isDirty:false,
    currentControlId:"",
    unloadMsg:"You are about to leave this XForms application",
    webtest:'@WEBTEST@',//todo: deprecated?
    isReady:false,
    contextroot:"",
    defaultAlertHandler:null,//todo: change to use behavior
    subscribers:[], //todo:see line above
    clientServerEventQueue:[],
    requestPending:false,
    fifoReaderTimer:null,
    lastServerClientFocusEvent:null,
    _earlyTemplatedStartup:true,
    widgetsInTemplate:true, //todo: still needed?
    usesDOMFocusIN:false,
    logEvents:false,


    /*
     keepAlive: function() {
     if(dwr.engine){
     dwr.engine.setErrorHandler(this._handleExceptions);
     dwr.engine.setOrdered(true);
     Flux.keepAlive(this.sessionKey);
     }
     },
     */
    constructor:function() {
        console.debug("FluxProcessor.constructor");
        /*
         var fluxAttribute = function(attribute) {
         return domAttr.get(dom.byId("fluxProcessor"), attribute);
         };
         */
        // This is used for referencing this object from within ajax-callback-functions
        this.indicatorContainer = document.getElementById('bfLoading');
        this.indicatorImage = document.getElementById('indicator');
        this.indicatorImage.className = 'xfDisabled';

        // Initialize the clientServerEventQueue for immediately being able to append Elements
        this.clientServerEventQueue = new Array();
        if (this.webtest != 'true') {
            connect.connect(window, "onbeforeunload", this, "handleUnload");
            connect.connect(window, "onunload", this, "close");
        }
        this.skipshutdown = false;

        //#########    ALERT IMPLEMENTATION  #############
        //#########    ALERT IMPLEMENTATION  #############
/*
        var globalAlertEnabled = query(".GlobalAlert", win.body())[0];
        if (globalAlertEnabled != undefined) {
            dojo.require("bf.GlobalAlert");
            this.defaultAlertHandler = new bf.GlobalAlert({});
            console.warn("!! WARNING: GLOBAL ALERT HANDLER NOT IMPLEMENTED YET !!!");
        }

        var bowlAlertEnabled = query(".BowlAlert", win.body())[0];
        if (bowlAlertEnabled != undefined) {
            dojo.require("bf.BowlAlert");
            this.defaultAlertHandler = new bf.BowlAlert({});
            console.warn("!! WARNING: BOWL ALERT HANDLER NOT IMPLEMENTED YET !!!");
        }

        var inlineRoundBordersAlertEnabled = query(".InlineRoundBordersAlert", win.body())[0];
        if (inlineRoundBordersAlertEnabled != undefined) {
            this.defaultAlertHandler = new bf.InlineRoundBordersAlert({});
        }

        var toolTipAlertEnabled = query(".ToolTipAlert", win.body())[0];
        if (toolTipAlertEnabled != undefined ) {
            dojo.require("bf.ToolTipAlert");
            this.defaultAlertHandler = new bf.ToolTipAlert({});
            // console.debug("Enabled ToolTipAlert Handler ", this.defaultAlertHandler);
        }
*/
        // TODO: Lars: implement Alerts as behaviour
/*
        var inlineAlertEnabled = query(".InlineAlert", win.body())[0];
        if (inlineAlertEnabled != undefined || this.defaultAlertHandler == undefined) {
            require(["bf/InlineAlert","dojo/domReady!"],
                function(InlineAlert) {
                    new InlineAlert({});
                });

            this.defaultAlertHandler = new bf.InlineAlert({});
            // console.debug("Enabled InlineAlert Handler ", this.defaultAlertHandler);

        }

        this.subscribers[0] = connect.subscribe("/xf/valid", this.defaultAlertHandler, "handleValid");
        this.subscribers[1] = connect.subscribe("/xf/invalid", this.defaultAlertHandler, "handleInvalid");
*/

        //#########    ALERT IMPLEMENTATION  END #############
        //#########    ALERT IMPLEMENTATION  END #############

        // Browser Detection
        this.userAgent = navigator.userAgent;
        console.debug("userAgent: ",this.userAgent);
    },

    //todo: deprecated? -> change to behavior
    setInlineRoundBorderAlertHandler:function() {
        console.debug("XFProcessor.setInlineRoundBorderAlertHandler");
        // this.hideAllCommonChilds(win.body());
        this.unsubscribeFromAlertHandler();
        this.defaultAlertHandler = new bf.InlineRoundBordersAlert({});
        this.subscribers[0] = connect.subscribe("/xf/valid", this.defaultAlertHandler, "handleValid");
        this.subscribers[1] = connect.subscribe("/xf/invalid", this.defaultAlertHandler, "handleInvalid");
        this.showAllCommonChilds(win.body(), "changeAlertType");

    },

    //todo: deprecated? -> change to behavior
    setToolTipAlertHandler:function() {
        console.debug("setToolTipAlertHandler");
        // this.hideAllCommonChilds(win.body());
        this.unsubscribeFromAlertHandler();
        dojo.require("bf.ToolTipAlert");
        this.defaultAlertHandler = new bf.ToolTipAlert({});
        this.subscribers[0] = connect.subscribe("/xf/valid", this.defaultAlertHandler, "handleValid");
        this.subscribers[1] = connect.subscribe("/xf/invalid", this.defaultAlertHandler, "handleInvalid");
        this.showAllCommonChilds(win.body(),"changeAlertType");
    },

    //todo: move to XFControl?
    // Hide commonChilds 'alert', 'hint', 'info'
    hideAllCommonChilds:function(node) {
        query(".xfControl", node).forEach(lang.hitch(this, function(control) {
            console.debug("hide commonChild for control: ", control);
            this.defaultAlertHandler._displayNone(domAttr.get(control,"id"),"applyChanges");
        }));
    },

    //todo: move to XFControl?
   // Show commonChilds 'alert', 'hint', 'info'
    showAllCommonChilds:function(node,event) {
        console.debug("FluxProcessor.showAllCommonChilds");
        query(".xfControl", node).forEach(lang.hitch(this, function(control) {
            // console.debug("hide/show commonChild for control: ", control, " control valid state is:", domClass.contains(control),"xfValid");
            if(domClass.contains(control,"xfValid")){
                this.defaultAlertHandler.handleValid(domAttr.get(control,"id"),event);
            }else {
                this.defaultAlertHandler.handleInvalid(domAttr.get(control,"id"),event);
            }
        }));
    },

    //todo: deprecated -> move to behavior
    unsubscribeFromAlertHandler:function() {
        console.debug("XFProcessor.unsubscribeFromAlertHandler");
        for (var i = 0; i < this.subscribers.length; i++) {
            connect.unsubscribe(this.subscribers[i]);
        }
    },

    handleUnload:function(evt) {
        console.debug("XFProcessor.handleUnload Event: ", evt);
        if (this.isDirty && !this.skipshutdown) {
            dojo.stopEvent(evt);
            // console.debug(this.unloadMsg);
            // For IE
            evt.returnValue = this.unloadMsg;
            // For all others
            return this.unloadMsg;
        }
    },

    close:function() {
        var tmpSkipShutdown = lang.hitch(this, fluxProcessor.skipShutdown).skipshutdown;
        if (!tmpSkipShutdown) {
            fluxProcessor.closeSession();
        }
    },

    closeSession: function() {
        try {
            dwr.engine.setErrorHandler(this._handleExceptions);
            dwr.engine.setOrdered(true);
            Flux.close(this.sessionKey);
        }
        catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux.closeSession ", ex);
        }
    },

    ignoreExceptions: function (msg) {
        console.warn("XFProcessor.ignoreExceptions():");
    },


    /* Tries to sequentially process pending Events, as long as there is no other roundtrip in progress (Client-Server-Client)
     * Initiates a roundtrip the following conditions apply:
     * 1) The related Objects still exist:  Dijit + Dojo/DOM
     * 2) The Control is NOT read-only (only validated if it CAN be read-only)
     * 3) If an appended Attribute is a reference, the target (dijit/dojo) still needs to exist.
     * ... changed references are updated. (e.g. xf:repeat items)
     */
    eventFifoReader: function() {
        console.debug("XFProcessor.eventFifoReader: this.clientServerEventQueue:",this.clientServerEventQueue);
        var nextPendingClientServerEvent = null;
        var dojoObject = null;
        var dijitObject = null;

        //Loop as long as Pending Events are being skipped (as long as no Request is being initiated)
        while ((!this.requestPending) && (this.clientServerEventQueue.length != 0)) {
            nextPendingClientServerEvent = this.clientServerEventQueue.shift();
            switch (nextPendingClientServerEvent.getCallerFunction()) {
                case "dispatchEvent":       console.info("FIFO-READ:  dispatchEvent(" + nextPendingClientServerEvent.getTargetId() + ")"); break;
                case "dispatchEventType":   console.info("FIFO-READ:  dispatchEventType(" + nextPendingClientServerEvent.getTargetId() + ", " + nextPendingClientServerEvent.getEventType() + ", " + nextPendingClientServerEvent.getContextInfo() + ")"); break;
                case "setControlValue":     console.info("FIFO-READ:  setControlValue(" + nextPendingClientServerEvent.getTargetId() + ", " + nextPendingClientServerEvent.getValue() + ")"); break;
                case "setRepeatIndex":      console.info("FIFO-READ: setRepeatIndex(" + nextPendingClientServerEvent.getTargetId() + ", " + nextPendingClientServerEvent.getValue() + ")"); break;
                default:                                        break;
            }

            //*****************************************************************************
            // START: skip this pending Event, if one of the following conditions occurred:
            //*****************************************************************************

            if(nextPendingClientServerEvent.getCallerFunction() == "setRepeatIndex"){
                dojoObject = query("*[repeatId='" + nextPendingClientServerEvent.getTargetId() + "']")[0];
            }else {
                dojoObject = dom.byId(nextPendingClientServerEvent.getTargetId());
            }
            // console.debug("EventFifoReader dojoObject:",dojoObject, " targetId: ",nextPendingClientServerEvent.getTargetId());
            if (dojoObject == null) {
                console.warn("Event (Client to Server) for Dojo Control " + dojoObject + " skipped. CAUSE: OBJECT is NULL",nextPendingClientServerEvent.getTargetId());
                continue;
            }

            if(nextPendingClientServerEvent.getCallerFunction() == "setRepeatIndex"){
                dijitObject = this._getRepeatObject(nextPendingClientServerEvent.getTargetId());
            }else {
                dijitObject = dijit.byId(nextPendingClientServerEvent.getTargetId());
            }


            // console.debug("EventFifoReader dijitObject:",dijitObject, " targetId: ",nextPendingClientServerEvent.getTargetId());

            if (dijitObject == null) {
                console.warn("XFProcessor.eventFifoReader: Event (Client to Server) for Dijit Control " + dijitObject + " skipped. CAUSE: OBJECT is NULL");
                continue;
            }

            // Test if this dijit-control has an isReadonly() method
            console.debug("XFProcessor.eventFifoReader: check if Object is readonly:",dijitObject, " reaondly: ",dijitObject.isReadonly());

            if (dijitObject && dijitObject.isReadonly()) {
                console.warn("XFProcessor.eventFifoReader: Event (Client to Server) for Dijit Control " + dijitObject + " skipped. CAUSE: READ-ONLY");
                continue;
            }

            // Test if the Control's event was a setControlValue
            if (nextPendingClientServerEvent.getCallerFunction() == "setControlValue") {
                // Test if the next Control-Value-Change originates from the same Control as this Control-Value-Change
                if (this.clientServerEventQueue[0] != null) {
                    // Test if the targetId of this event and the next one are equal
                    if (this.clientServerEventQueue[0].getTargetId() == nextPendingClientServerEvent.getTargetId()) {
                        // Test if the CallerFunction of the next Event is also setControlValue
                        if (this.clientServerEventQueue[0].getCallerFunction() == "setControlValue") {
                            console.debug("XFProcessor.eventFifoReader: Event (Client to Server) for Dijit Control " + dijitObject + " skipped. CAUSE: superseeded by following value-change of same Control");
                            continue;
                        }
                        else {
                            //console.debug("Nothing to skip. CAUSE: Following Event's CallerFunction differs from setControlValue");
                        }
                    }
                    else {
                        // console.debug("Nothing to skip. CAUSE: Next Event's ID was different from this Event's ID");
                    }
                }
                else {
                    // console.debug("Nothing to skip. CAUSE: Buffer was empty");
                }
            }
            else {
                // console.debug("Nothing to skip. CAUSE: No setControlValue found");
            }

            // Further processing of setRepeatIndex events
            // TODO: check if really not needed anymore
/*
            if (nextPendingClientServerEvent.getCallerFunction() == "setRepeatIndex") {
                if (nextPendingClientServerEvent.getRepeatItem() == null) {
                    console.warn("Event (Client to Server) for Dijit Control " + nextPendingClientServerEvent.getTargetId() + " skipped. CAUSE: Repeat-Item for being selected has disappeared");
                    continue;
                }

                if (nextPendingClientServerEvent.getValue() != dijit.byNode(nextPendingClientServerEvent.getRepeatItem())._getXFormsPosition()) {
                    console.warn("Original Position: " + nextPendingClientServerEvent.getValue + " New Position: " + nextPendingClientServerEvent.getRepeatItem()._getXFormsPosition());
                    // Update the changed Position of this XForms-Repeat-Item
                    nextPendingclientServerEvent.setValue(dijit.byNode(nextPendingClientServerEvent.getRepeatItem())._getXFormsPosition());
                }
            }
*/

            //*****************************************************************************
            // END:   skip this pending Event, if one of the following conditions occurred:
            //*****************************************************************************

            if (dojoObject != null) {
                this._useLoadingMessage(dojoObject);
            }

            // console.debug("XFProcessor.dispatch event for ",nextPendingClientServerEvent.getCallerFunction());
            switch (nextPendingClientServerEvent.getCallerFunction()) {
                case "dispatchEvent":                this.requestPending = true; this._dispatchEvent(nextPendingClientServerEvent.getTargetId()); break;
                case "dispatchEventType":        this.requestPending = true; this._dispatchEventType(nextPendingClientServerEvent.getTargetId(), nextPendingClientServerEvent.getEventType(), nextPendingClientServerEvent.getContextInfo()); break;
                case "setControlValue":            this.requestPending = true; this._setControlValue(nextPendingClientServerEvent.getTargetId(), nextPendingClientServerEvent.getValue()); break;
                //Re-transform the dojo-Id to repeat-Id
                case "setRepeatIndex":            this.requestPending = true; this._setRepeatIndex(nextPendingClientServerEvent.getTargetId(), nextPendingClientServerEvent.getValue()); break;
                default:                                        break;
            }
        }
        // console.debug("XFProcessor after Event is dispatched ");
        //Check if there are still more events pending
        if (this.clientServerEventQueue.length != 0) {
            clearTimeout(this.fifoReaderTimer);
            // Just to be sure, that the FIFO Buffer is being checked even in case, that an AJAX-response got lost
            this.fifoReaderTimer = setTimeout("fluxProcessor.eventFifoReader()", 2000);
        }
        else {
            //the last Request has been sent ... stop the timer
            clearTimeout(this.fifoReaderTimer);
        }
    },

    /*
     * Appends the provided clientServerEvent to the Pending-Event-FIFO-Buffer
     * Triggers the FIFO-Reader for trying to process the next pending events at the FIFO-Buffer.
     */
    eventFifoWriter: function(clientServerEvent) {
        console.debug("XFProcessor.eventFifoWriter clientServerEvent:",clientServerEvent);

        //insert the new clientServerEvent at the beginning of the Buffer
        this.clientServerEventQueue.push(clientServerEvent);
        switch (clientServerEvent) {
            case "dispatchEvent":      console.info("FIFO-WRITE: dispatchEvent(" + clientServerEvent.getTargetId() + ")"); break;
            case "dispatchEventType":  console.info("FIFO-WRITE: dispatchEventType(" + clientServerEvent.getTargetId() + ", " + clientServerEvent.getEventType() + ", " + clientServerEvent.getContextInfo() + ")"); break;
            case "setControlValue":    console.info("FIFO-WRITE: setControlValue(" + clientServerEvent.getTargetId() + ", " + clientServerEvent.getValue() + ")"); break;
            case "setRepeatIndex":     console.info("FIFO-WRITE: setRepeatIndex(" + clientServerEvent.getTargetId() + ", " + clientServerEvent.getValue() + ")"); break;
            default:                   break;
        }
        //schedule the next try for reading the next pending Event of the FIFO-Buffer
        clearTimeout(this.fifoReaderTimer);
        this.fifoReaderTimer = setTimeout("fluxProcessor.eventFifoReader()", 0);
    },

    //eventually an 'activate' method still makes sense to provide a simple DOMActivate of a trigger Element
    dispatchEvent: function (targetId) {
        console.debug("XFProcessor.dispatchEvent targetId:",targetId);

        var newClientServerEvent = new ClientServerEvent();
        newClientServerEvent.setTargetId(targetId);
        newClientServerEvent.setCallerFunction("dispatchEvent");
        this.eventFifoWriter(newClientServerEvent);
    },

    //eventually an 'activate' method still makes sense to provide a simple DOMActivate of a trigger Element
    _dispatchEvent: function (targetId) {
        console.debug("XFProcessor.dispatch(",targetId,") this: ", this);
        try {
            dwr.engine.setErrorHandler(this._handleExceptions);
            dwr.engine.setOrdered(true);
            Flux.dispatchEvent(targetId, this.sessionKey, this.applyChanges);
        } catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux.dispatchEvent", ex);
        }
        return false;
    },

    dispatchEventType:function(targetId, eventType, contextInfo) {
        console.debug("XFProcessor.dispatchEventType(",targetId,") this: ", this, " eventType:",eventType, " contextInfo:",contextInfo);
        var newClientServerEvent = new ClientServerEvent();
        newClientServerEvent.setTargetId(targetId);
        newClientServerEvent.setEventType(eventType);
        newClientServerEvent.setContextInfo(contextInfo);
        newClientServerEvent.setCallerFunction("dispatchEventType");
        this.eventFifoWriter(newClientServerEvent);
    },

    _dispatchEventType:function(targetId, eventType, contextInfo) {
        console.debug("XFProcessor._dispatchEventType(",targetId,") this: ", this, " eventType:",eventType, " contextInfo:",contextInfo);
        try {
            dwr.engine.setErrorHandler(this._handleExceptions);
            dwr.engine.setOrdered(true);
            if (contextInfo == undefined) {
                Flux.dispatchEventType(targetId, eventType, this.sessionKey, lang.hitch(this, this.applyChanges));
            } else {
                Flux.dispatchEventTypeWithContext(targetId, eventType, this.sessionKey, contextInfo, lang.hitch(this, this.applyChanges));
            }
        }
        catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux.dispatchEventType", ex);
        }
    },

    /*
    Sends a value from a widget to the server. Will be called after any user interaction.
     */
    sendValue: function(id, value) {
        console.debug("XFProcessor.sendValue", id, value);
        var newClientServerEvent = new ClientServerEvent();
        newClientServerEvent.setTargetId(id);
        newClientServerEvent.setValue(value);
        newClientServerEvent.setCallerFunction("setControlValue");
        this.eventFifoWriter(newClientServerEvent);
    },

    _setControlValue: function (id, value) {
        console.debug("XFProcessor.setControlValue", id, value);
        this.isDirty = true;
        try {
            dwr.engine.setErrorHandler(this._handleExceptions);
            dwr.engine.setOrdered(true);
            dwr.engine.setErrorHandler(this._handleExceptions);
            //        Flux.setUIControlValue(id, value, this.sessionKey,this.changeManager.applyChanges);
            Flux.setUIControlValue(id, value, this.sessionKey, this.applyChanges);
        }
        catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux.setControlValue", ex);
        }
    },

    setRepeatIndex: function(/*String*/repeatId, /*String*/targetPosition) {
        console.debug("FluxProcessor.setRepeatIndex repeatId:",repeatId, " targetPosition:",targetPosition);
        var newClientServerEvent = new ClientServerEvent();
        newClientServerEvent.setTargetId(repeatId);
        newClientServerEvent.setValue(targetPosition);
        newClientServerEvent.setCallerFunction("setRepeatIndex");
        this.eventFifoWriter(newClientServerEvent);
    },

    _setRepeatIndex:function(/*String*/repeatId, /*String*/targetPosition) {
        // console.debug("XFProcessor.setRepeatIndex for Repeat "+ repeatId + " to position " + targetPosition);
        try {
            dwr.engine.setErrorHandler(this._handleExceptions);
            dwr.engine.setOrdered(true);
            Flux.setRepeatIndex(repeatId, targetPosition, this.sessionKey, this.applyChanges);
        } catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux.setRepeatIndex", ex);
        }
    },


    //################################################################################################
    //################################################################################################
    //################################################################################################

    /*
     setRange: function (id, value) {
     dwr.engine.setErrorHandler(this._handleExceptions);
     Flux.setXFormsValue( id, value, this.sessionKey,this.changeManager.applyChanges);
     },


     */

    indicatorObjectTimer: null,
    indicatorContainer: null,
    indicatorImage: null,
    indicatorTargetObject: null,


    _fifoProcessingFinished: function() {
        console.debug("XFProcessor._fifoProcessingFinished");
        domClass.remove(this.indicatorTargetObject, "bfPending");
        // Don't iterate through all items ... only use the last one and skip the rest
        var currentItem = this.lastServerClientFocusEvent;
        if (currentItem != undefined) {
            if (currentItem != null) {
                currentItem.postponedFunction(currentItem.postponedXmlEvent);
                this.lastServerClientFocusEvent = null;
            }
        }


        fluxProcessor.indicatorImage.className = 'xfDisabled';
    },

    _useLoadingMessage:function(dojoObject) {
        console.debug("XFProcessor._useLoadingMessage dojoObject:",dojoObject);
        if (fluxProcessor.indicatorObjectTimer) {
            clearTimeout(fluxProcessor.indicatorObjectTimer);
        }
        if (this.indicatorTargetObject) {
            domClass.remove(this.indicatorTargetObject, "bfPending");
        }

        this.indicatorTargetObject = dojoObject;

        domClass.add(dojoObject, "bfPending");

        try {
            dwr.engine.setPreHook(function() {
                fluxProcessor.indicatorImage.className = 'xfEnabled';
                return false;
            });
            dwr.engine.setPostHook(function() {
                fluxProcessor.indicatorObjectTimer = setTimeout('fluxProcessor._fifoProcessingFinished()', 500);
                return false;
            });
        }
        catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux._useLoadingMessage", ex);
        }
    },

    _handleExceptions:function(msg, exception) {
        console.debug("XFProcessor._handleExceptions msg:",msg, " exception: ", exception);
        if (msg != undefined && exception != undefined) {
            console.error(msg, ' - Exception: ', exception);
        } else if (msg != undefined) {
            console.error(msg);
            if (this.webtest != 'true') {
                alert(msg);
            } else {
                //only for testing purposes
                this.logTestMessage(xmlEvent.contextInfo.errorinformation);
            }
        } else {
            console.error("Unknown exception occured! arguments: ", arguments);
        }
    },

    applyChanges: function(data) {
        try {
            var validityEvents = new Array();
            var index = 0;

            //eventLog writing
            var eventLog = dom.byId("eventLog");

            dojo.forEach(data,
                    function(xmlEvent) {
                        // *** DO NOT COMMENT THIS OUT !!! ***
                        console.debug("XFProcessor.applyChanges:", xmlEvent.type, " [", xmlEvent.contextInfo, "]");

/*
                        if 'logEvents' is true the eventlog from the server will be written
                        to DOM and can be viewed in a separate expandable section in the window.
*/
                        //todo: the following code should be made a behavior only if debugging is available
                        //probably we have to add a private _applyChanges method to do the actual work to
                        //allow us to hook to this function and connect to it for outputting debug output.
                        if(fluxProcessor.logEvents){
                            //iterate contextinfo
                            var contextInfo = xmlEvent.contextInfo;
                            var tableCells = "";

                            for (dataItem in contextInfo){
                                var funcArg = contextInfo[dataItem];

                                //suppressing empty default info
                                if(funcArg != null) {
                                    if(dataItem == "targetId" &&
                                        (xmlEvent.type == "betterform-state-changed" ||
                                         xmlEvent.type == "xforms-value-changed" ||
                                         xmlEvent.type == "xforms-valid" ||
                                         xmlEvent.type == "xforms-invalid" ||
                                         xmlEvent.type == "xforms-readonly" ||
                                         xmlEvent.type == "xforms-readwrite" ||
                                         xmlEvent.type == "xforms-required" ||
                                         xmlEvent.type == "xforms-optional" ||
                                         xmlEvent.type == "xforms-enabled" ||
                                         xmlEvent.type == "DOMFocusOut" ||
                                         xmlEvent.type == "DOMActivate" ||
                                         xmlEvent.type == "betterform-AVT-changed"
                                         )
                                    ){
                                        tableCells += "<tr><td class='propName'>"+ dataItem + "</td><td class='propValue'><a href='#' onclick='bf.devtool.reveal(this);'>" + contextInfo[dataItem] + "</a></td></tr>"
                                    }else if(dataItem == "targetElement" && xmlEvent.type == "betterform-load-uri"){
                                        var targetElement = contextInfo.xlinkTarget;
                                        tableCells += "<tr><td class='propName'>"+ dataItem + "</td><td class='propValue'><a href='#' onclick='bf.devtool.reveal(this);'>" + targetElement + "</a></td></tr>"
                                    }
                                    else {
                                        tableCells += "<tr><td class='propName'>"+ dataItem + "</td><td class='propValue'>" +  contextInfo[dataItem] + "</td></tr>"
                                    }
                                }
                            }
                            //create output
                            dojo.create("li", {
                                innerHTML: "<a href='#' onclick='bf.devtool.toggleEntry(this);'><span>"+xmlEvent.type+"</span></a><table class='eventLogTable'>" + tableCells + "</table>"
                            }, eventLog);
                        }
                        switch (xmlEvent.type) {
                            case "betterform-index-changed"      : fluxProcessor._handleBetterFormIndexChanged(xmlEvent); break;
                            case "betterform-insert-itemset"     : fluxProcessor._handleBetterFormInsertItemset(xmlEvent); break;
                            case "betterform-insert-repeatitem"  : fluxProcessor._handleBetterFormInsertRepeatItem(xmlEvent); break;
                            case "betterform-item-deleted"       : fluxProcessor._handleBetterFormItemDeleted(xmlEvent); break;
                            case "betterform-load-uri"           : fluxProcessor._handleBetterFormLoadURI(xmlEvent); break;
                            case "betterform-render-message"     : fluxProcessor._handleBetterFormRenderMessage(xmlEvent); break;
                            case "betterform-replace-all"        : fluxProcessor._handleBetterFormReplaceAll(); break;
                            case "betterform-state-changed"      : fluxProcessor._handleBetterFormStateChanged(xmlEvent); break;
                            case "betterform-dialog-open"        : fluxProcessor._handleBetterFormDialogOpen(xmlEvent); break;
                            case "betterform-dialog-close"       : fluxProcessor._handleBetterFormDialogClose(xmlEvent); break;
                            case "betterform-AVT-changed"        : fluxProcessor._handleAVTChanged(xmlEvent);break;
                            case "betterform-instance-created"   : fluxProcessor._handleInstanceCreated(xmlEvent);break;
                            case "betterform-model-removed"      : fluxProcessor._handleModelRemoved(xmlEvent);break;
                            case "betterform-exception"          : fluxProcessor._handleBetterformException(xmlEvent); break;
                            case "upload-progress-event"         : fluxProcessor._handleUploadProgressEvent(xmlEvent); break;
                            case "xforms-focus"                  : fluxProcessor._handleXFormsFocus(xmlEvent); break;
                            case "xforms-help"                   : fluxProcessor._handleShowHelp(xmlEvent); break;
                            case "xforms-hint"                   : fluxProcessor._handleXFormsHint(xmlEvent); break;
                            case "xforms-link-exception"         : fluxProcessor._handleLinkException(xmlEvent); break;
                            case "betterform-switch-toggled"     : fluxProcessor._handleSwitchToggled(xmlEvent); break;
                            case "betterform-script-action"      : eval(xmlEvent.contextInfo["script"]); break;
                            case "xforms-value-changed"          : /* console.debug(xmlEvent); */ break;
                            case "xforms-version-exception"      : fluxProcessor._handleVersionException(xmlEvent); break;
                            case "xforms-binding-exception"      : fluxProcessor._handleBindingException(xmlEvent);break;
                            case "xforms-submit-error"           : fluxProcessor._handleSubmitError(xmlEvent); break;
                            case "DOMFocusIn"                    : fluxProcessor.lastServerClientFocusEvent = {postponedFunction:fluxProcessor._handleDOMFocusIn, postponedXmlEvent:xmlEvent}; break;    //cache the xmlEvent for being processed later
                            case "xforms-out-of-range"           : fluxProcessor._handleOutOfRange(xmlEvent);break;
                            case "xforms-in-range"               : fluxProcessor._handleInRange(xmlEvent);break;
                            case "xforms-invalid"                : break;
                            case "xforms-valid"                  : validityEvents[index] = xmlEvent; index++;break;
                            case "betterform-id-generated"       : break;
                            case "DOMActivate"                   : break;
                            case "xforms-select"                 : break;
                            case "xforms-deselect"               : break;
                            case "DOMFocusOut"                   : break;
                            case "xforms-model-construct"        : break;
                            case "xforms-model-construct-done"   : fluxProcessor._buildUI();  break;
                            case "xforms-ready"                  : this.isReady = true;connect.publish("/xf/ready", []);break; //not perfect - should be on XFormsModelElement
                            case "xforms-submit"                 : break;
                            case "xforms-submit-done"            : fluxProcessor._handleSubmitDone(xmlEvent);break;
                            /* Unknow XMLEvent: */
                            default                              : console.error("Event " + xmlEvent.type + " unknown [Event:", xmlEvent, "]"); break;
                        }
                    }
                    );

            if(fluxProcessor.logEvents){
                // add a devider for eventLogViewer
                dojo.create("li", {
                    innerHTML: "<span class='logDevider'/>"
                }, eventLog);
            }

            if (validityEvents.length > 0) {
                fluxProcessor._handleValidity(validityEvents);
            }
        }
        catch(ex) {
            fluxProcessor._handleExceptions("An error occurred during applyChanges ", ex);
        }
        //The pending request tournaround has been completed
        fluxProcessor.requestPending = false;
        //Schedule the next FIFO-Read try in 0 ms
        clearTimeout(fluxProcessor.fifoReaderTimer);
        fluxProcessor.fifoReaderTimer = setTimeout("fluxProcessor.eventFifoReader()", 0);
    },

    _buildUI : function(){
        console.debug("XFProcessor._buildUI ControlBehavior:",ControlBehavior, " InputBehavior:",InputBehavior);
        behavior.add(ControlBehavior);
        behavior.add(OutputBehavior);
        behavior.add(InputBehavior);
        behavior.add(TriggerBehavior);
        behavior.apply();
    },

    _handleAVTChanged:function(xmlEvent){
        console.debug("XFProcessor._handleAVTChanged xmlEvent:",xmlEvent);
        domAttr.set(xmlEvent.contextInfo.targetId, xmlEvent.contextInfo.attribute, xmlEvent.contextInfo.value);
    },

    _handleInstanceCreated:function(xmlEvent){
        console.debug("XFProcessor._handleInstanceCreated xmlEvent:",xmlEvent);
        /* TODO: Lars: upgrade to Dojo 1.7 */
        /*
        dojo.require("dojox.fx");
        var debugPane = dom.byId("debug-pane-links");

        if(debugPane != null){
            var contextroot = domAttr.get(dom.byId("debug-pane"),"context");
            var newLink = document.createElement("a");
            domAttr.set(newLink,"href",contextroot + xmlEvent.contextInfo.modelId + "/" + xmlEvent.contextInfo.instanceId);
            domAttr.set(newLink,"target","_blank");
            domAttr.set(newLink,"modelId",xmlEvent.contextInfo.modelId);
            var linkText = document.createTextNode("Model:" + xmlEvent.contextInfo.modelId + " :: " + "Instance:" + xmlEvent.contextInfo.instanceId);
            newLink.appendChild(linkText);
            debugPane.appendChild(newLink);
            dojox.fx.highlight({node:newLink, color:'#999999', duration:600}).play()
        }
*/
    },

    _handleModelRemoved:function(xmlEvent){
        console.debug("XFProcessor._handleModelRemoved xmlEvent:",xmlEvent);
        var modelId = xmlEvent.contextInfo.modelId;
        query("#debug-pane a[modelId='" + modelId +"']").orphan();

    },

    _handleValidity:function(validityEvents) {
        console.debug("XFProcessor._handleValidity validityEvents:",validityEvents);
        dojo.forEach(validityEvents, function(xmlEvent) {
            var control = dijit.byId(xmlEvent.contextInfo.targetId);
            if (control != undefined) {
                if (xmlEvent.type == "xforms-valid") {
                    control.setValid();
                } else {
                    control.setInvalid();
                }
            }
        });
    },


    /*
        ******************************************************************************************************
        * handles XForms binding exception
        ******************************************************************************************************
     */
    _handleBindingException:function(xmlEvent) {
        //todo: must be reviewed completely
        console.debug("XFProcessor._handleBindingException xmlEvent:",xmlEvent);

        if (this.webtest != 'true') {
            console.warn("xforms-binding-exception at " + xmlEvent.contextInfo.targetId + " - " + xmlEvent.contextInfo.defaultinfo);
        } else {
            //only for testing purposes
            this.logTestMessage("xforms-binding-exception");
        }
    },

    /*
         ******************************************************************************************************
         * handles XForms Version exception
         ******************************************************************************************************
     */
    _handleVersionException:function(xmlEvent) {
        //todo: must be reviewed completely
        if (this.webtest != 'true') {
            console.error(xmlEvent.contextInfo.errorinformation);
        } else {
            //only for testing purposes
            this.logTestMessage(xmlEvent.contextInfo.errorinformation);
        }
    },

    /*
         ******************************************************************************************************
         * handles arbitrary exception occuring on server-side and write them our to DOM
         ******************************************************************************************************
     */
     _handleBetterformException:function(xmlEvent) {
        console.debug("XFProcessor._handleBetterformException xmlEvent:",xmlEvent);
        if (this.webtest != 'true') {
            var description = xmlEvent.contextInfo.message;
            console.error(xmlEvent.contextInfo.message);
            var exception = dom.byId('betterFORM-exception');
            var log;
            var exceptionText;
            if (!exception) {
                log = document.createElement('div');
                log.id = 'betterFORM-exceptionLog';
                document.body.appendChild(log);
                exception = document.createElement('exception');
                exception.id = 'betterFORM-exception';
                exceptionText = document.createTextNode(description);
                exception.appendChild(exceptionText);
                log.appendChild(exception);
            } else {
                exception.removeChild(exception.firstChild);
                exceptionText = document.createTextNode(description);
                exception.appendChild(exceptionText);
            }
        } else {
            //only for testing purposes
            fluxProcessor.logTestMessage(xmlEvent.contextInfo.message);
        }
    },

    /*
         ******************************************************************************************************
         * handles XForms submit error by publishing /xf/invalid to all invalid controls and adding
         * a class 'xfRequiredEmpty' to required controls that have no value
         ******************************************************************************************************
     */
    _handleSubmitError:function(xmlEvent) {
        console.warn("xforms-submit-error at ", xmlEvent.contextInfo);
        query(".xfInvalid", win.body()).forEach(function(control) {
            // console.debug("_handleSubmitError: invalid control: ", control);
            connect.publish("/xf/invalid", [domAttr.get(control, "id"),"submitError"]);
        });
        query(".xfRequired", win.body()).forEach(function(control) {
            //if control has no value add CSS class xfRequiredEmpty
            var xfControl = dijit.byId(control.id);
            if(xfControl != undefined && xfControl.getControlValue === 'function'){
                var xfValue = xfControl.getControlValue();
                if(xfValue == undefined || xfValue == ''){
                    domClass.add(xfControl.domNode,"xfRequiredEmpty");

                }
            }
        });
    },


    /*
         ******************************************************************************************************
         * handles the XForms load actions including the embedding of subforms.
         ******************************************************************************************************
     */
    _handleBetterFormLoadURI:function(/*XMLEvent*/ xmlEvent) {
        console.debug("XFProcessor._handleBetterFormLoadURI xmlEvent:",xmlEvent);

        // xf:load show=replace
        if (xmlEvent.contextInfo.show == "replace") {
            fluxProcessor.skipshutdown = true;
            window.location.href = xmlEvent.contextInfo.uri;
        }
        // xf:load show=new
        else if (xmlEvent.contextInfo.show == "new") {
            window.open(xmlEvent.contextInfo.uri, '_betterform', 'menubar=yes,toolbar=yes,location=yes,directories=yes,fullscreen=no,titlebar=yes,hotkeys=yes,status=yes,scrollbars=yes,resizable=yes');

        }
        /* xf:load show=embed
         to embed an existing form into the running form
         */
        else if (xmlEvent.contextInfo.show == "embed") {
//            console.debug("xmlEvent.contextInfo.show='embed'", this);
            // getting target from event - can be either the value of a 'name' or 'id' Attribute
            var xlinkTarget = xmlEvent.contextInfo.xlinkTarget;

            //determine the DOM Element in the client DOM which is the target for embedding
            var targetid;
            if (dom.byId(xlinkTarget) != undefined) {
                targetid = xlinkTarget;
            } else {
                // if we reach here the xlinkTarget is no idref but the value of a name Attrbute that needs resolving
                // to an id.
                var tmp = query("*[name='" + xlinkTarget + "']")[0];
                targetid = tmp.id;
                console.debug("target id for embedding is: ", targetid);
            }

            this._unloadDOM(targetid);

            //get original Element in master DOM
            var htmlEntryPoint = dom.byId(targetid);
            htmlEntryPoint.innerHTML = xmlEvent.contextInfo.targetElement;
            domAttr.set(htmlEntryPoint, "id", xlinkTarget + "Old");
            var nodesToEmbed = dom.byId(targetid);

            require("dojo/parser", function(parser){
                parser.parse(htmlEntryPoint);
            });

            // dojo.parser.parse(htmlEntryPoint);

            dojo.place(nodesToEmbed, htmlEntryPoint, "before");
//            dojo.fx.wipeIn({node: nodesToEmbed,duration: 500}).play();
            domStyle.set(nodesToEmbed,"display","block");

            //copy classes from mountpoint
            var classes = domAttr.get(htmlEntryPoint, "class");
            domAttr.set(nodesToEmbed, "class", classes);
            htmlEntryPoint.parentNode.removeChild(htmlEntryPoint);

            // finally dynamically load the CSS (if some) form the embedded form
            var cssToLoad = xmlEvent.contextInfo.inlineCSS;
//            console.debug("css to load: ", cssToLoad);
            var headID = document.getElementsByTagName("head")[0];
            var mountpoint = dom.byId(xlinkTarget);

            if(cssToLoad != undefined && cssToLoad != ""){
                //console.debug("adding Style: ", cssToLoad);
                var stylesheet1 = document.createElement('style');
                stylesheet1.setAttribute("type", "text/css");
                stylesheet1.setAttribute("name", xlinkTarget);
                var head1 = document.getElementsByTagName('head')[0];
                head1.appendChild(stylesheet1);
                if (stylesheet1.styleSheet) {   // IE
                        stylesheet1.styleSheet.cssText = cssToLoad;
                } else {                // the world
                        var textNode1 = document.createTextNode(cssToLoad);
                        stylesheet1.appendChild(textNode1);
                }
            }

            var externalCssToLoad = xmlEvent.contextInfo.externalCSS;

            if (externalCssToLoad != undefined && externalCssToLoad != "") {
                var styles = externalCssToLoad.split('#');
                var head2 = document.getElementsByTagName('head')[0];
                for (var i = 0; i <= styles.length; i = i+1) {
                    if (styles[i] != undefined && styles[i] != "") {
                        //console.debug("adding Style: ", styles[i]);
                        var stylesheet2 = document.createElement('link');
                        stylesheet2.setAttribute("rel","stylesheet");
                        stylesheet2.setAttribute("type","text/css");
                        stylesheet2.setAttribute("href",styles[i]);
                        stylesheet2.setAttribute("name",xlinkTarget);
                        head2.appendChild(stylesheet2);
                    }
                }
            }

            var inlineJavaScriptToLoad = xmlEvent.contextInfo.inlineJavascript;
            if (inlineJavaScriptToLoad != undefined && inlineJavaScriptToLoad != "") {
                //console.debug("adding script: ", inlineJavaScriptToLoad);
                var javascript1 = document.createElement('script');
                javascript1.setAttribute("type", "text/javascript");
                javascript1.setAttribute("name", xlinkTarget);
                var head3 = document.getElementsByTagName('head')[0];
                head3.appendChild(javascript1);
                javascript1.text = inlineJavaScriptToLoad;
            }

            var externalJavaScriptToLoad = xmlEvent.contextInfo.externalJavascript;
            if (externalJavaScriptToLoad != undefined && externalJavaScriptToLoad != "") {
                var scripts = externalJavaScriptToLoad.split('#');
                var head4 = document.getElementsByTagName("head")[0];
                for (var z = 0; z <= scripts.length; z = z+1) {
                    if (scripts[z] != undefined && scripts[z] != "") {
                        //console.debug("adding script: ", scripts[z]);
                        var javascript2 = document.createElement('script');
                        javascript2.setAttribute("type","text/javascript");
                        javascript2.setAttribute("src",scripts[z]);
                        javascript2.setAttribute("name",xlinkTarget);
                        head4.appendChild(javascript2);
                    }
                }
            }

        }
        /*  xf:load show=none
         to unload (loaded) subforms
         */
        else if (xmlEvent.contextInfo.show == "none") {
            // console.debug("XFProcessor._handleBetterFormLoadURI: htmlEntryPoint", htmlEntryPoint);
            this._unloadDOM(xmlEvent.contextInfo.xlinkTarget);
        }
        else {
            console.error("betterform-load-uri show='" + xmlEvent.contextInfo.show + "' unknown!");
        }
    },

    /*
         ******************************************************************************************************
         * handles XForms xforms-submit-done events
         ******************************************************************************************************
     */
    _handleSubmitDone:function(xmlEvent) {
        console.debug("XFProcessor._handleSubmitDone xmlEvent:",xmlEvent);

        if (xmlEvent.contextInfo.document != null) {
            //***** handle submission replace="new" *****
            //***** handle submission replace="new" *****
            //***** handle submission replace="new" *****
            var doc = xmlEvent.contextInfo.document;
            var newWindow = window.open();
            newWindow.document.write(doc);
            newWindow.document.close();
        } else if (xmlEvent.contextInfo.embedElement != null) {
            //*****   handle submission replace="embedHTML" *****
            //*****   handle submission replace="embedHTML" *****
            //*****   handle submission replace="embedHTML" *****
            if (xmlEvent.contextInfo.embedTarget == undefined) {
                return;
            }
            var target = xmlEvent.contextInfo.embedTarget;
            var content = xmlEvent.contextInfo.embedElement;


            //determine the DOM Element in the client DOM which is the target for embedding
            var targetid;
            if (dom.byId(target) != undefined) {
                targetid = target;
            } else {
                // if we reach here the target is no idref but the value of a name Attrbute that needs resolving
                // to an id.
                var tmp = query("*[name='" + target + "']")[0];
                targetid = tmp.id;
                console.debug("target id for embedding is: ", targetid);
            }

            this._unloadDOM(targetid);

            //get original Element in master DOM
            var htmlEntryPoint = dom.byId(targetid);
            htmlEntryPoint.innerHTML = content;
            require("dojo/parser", function(parser){
                parser.parse(htmlEntryPoint);
            });

//            dojo.require("dojo.parser");
//            dojo.parser.parse(htmlEntryPoint);
        }
    },

    //todo: see above '_handleBetterFormLoadURI'  - should be moved behind handleLoadURI function
    _unloadDOM:function(target) {
        console.debug("XFProcessor._unloadDOM xmlEvent:",xmlEvent);

        //delete CSS specific to subform
        var htmlEntryPoint = dom.byId(target);
        if (htmlEntryPoint == undefined) {
            return;
        }

        var styleList = document.getElementsByTagName("style");
        //console.debug("styleList" , styleList);
        if (styleList != undefined) {
        dojo.forEach(styleList, function(item) {
                //console.debug("style: ", item);
                if (item != undefined) {
            if(domAttr.get(item,"name") == target){
                        //console.debug("removing style: ", item);
                        //console.debug("parentNode: ", item.parentNode);
                item.parentNode.removeChild(item);
            }
                }
        });
        }

        /*
        unload previously loaded subform-specific stylesheets
         */
        var externalStyleList = document.getElementsByTagName("link");
        console.debug("styleList" , externalStyleList);
        if (externalStyleList != undefined) {
        dojo.forEach(externalStyleList, function(item) {
                //console.debug("style: ", item);
                if (item != undefined) {
            if(domAttr.get(item,"name") == target){
                        console.debug("removing style: ", item);
                        console.debug("parentNode: ", item.parentNode);
                item.parentNode.removeChild(item);
            }
                }
        });
        }

        /*
        unload previously loaded subform-specific Javascripts
         */
        var scriptList = document.getElementsByTagName("script");
        //console.debug("scriptList" , scriptList);
        if (scriptList != undefined) {
            dojo.forEach(scriptList, function(item) {
                //console.debug("script: ", item);
                if (item != undefined) {
                    if(domAttr.get(item,"name") == target){
                        //console.debug("removing: ", item);
                        //console.debug("parentNode: ", item.parentNode);
                        item.parentNode.removeChild(item);
                    }
                }
            });
        }

        var widgetID = "widgetid";
        if (dojo.isIE) {
            widgetID = "widgetId"
        }

        /*
        destroy all child dijits within subform tree
         */
        var widgets = query("*[" + widgetID + "]", htmlEntryPoint);
        dojo.forEach(widgets,
                function(item) {
                    if (item != undefined) {
                        var childDijit = dijit.byId(domAttr.get(item, 'id'));
                        if (childDijit != undefined) {
                            // console.debug("XFProcessor._unloadDOM: destroy ", childDijit);
                            childDijit.destroy();
                        } else {
                            // console.debug("XFProcessor._unloadDOM: ChildDijit is null ");
                            childDijit = dijit.byId(domAttr.get(item, widgetID));
                            if (childDijit != undefined) {
                                childDijit.destroy();
                            }
                        }

                    }
                }
                );
        while (htmlEntryPoint.hasChildNodes()) {
            htmlEntryPoint.removeChild(htmlEntryPoint.firstChild);
        }
    },

    /*
         ******************************************************************************************************
         * handles XForms message actions
         ******************************************************************************************************
     */
    _handleBetterFormRenderMessage:function(/*XMLEvent*/ xmlEvent) {
        console.debug("XFProcessor._handleBetterFormRenderMessage xmlEvent:", xmlEvent);
        var message = xmlEvent.contextInfo.message;
        var level = xmlEvent.contextInfo.level;
        //console.debug("XFProcessor.handleRenderMessage: message='" + message + "', level='" + level + "'");
        if (this.webtest != 'true') {

            if (level == "ephemeral") {
                dijit.byId("betterformMessageToaster").setContent(message, 'message');
                dijit.byId("betterformMessageToaster").show();
            }
            else {
                var exception = xmlEvent.contextInfo.exception;
                if (exception != undefined) {
                    console.warn("An Exception occured in Facade: ", exception);
                } else {
                    alert(message);
                    // the following code had to be disabled because of focusing problems:
                    // when dialog is opened by a DOMFocusIn event the behavior of Dialog cause an endless loop
                    // of focusIn events as the Dialog will send the focus back to the control that had focus before
                    // opening the Dialog. This effectively causes the page to 'hang'. Focusing can be disabled in
                    // Dialog but then the original focus will be lost. The standard alert does not have these
                    // problems.

/*


                    var messageNode = dojo.create("div",  null, dojo.body());
                    domAttr.set(messageNode, "title", "Message");
                    dojo.require("dijit.Dialog");
                    var messageDialog = new dijit.Dialog({
                        title: "Message: ",
                        content: message

                    }, messageNode);

                    var closeBtnWrapper = dojo.create("div", null , messageDialog.domNode);

                    domStyle.set(closeBtnWrapper, "position","relative");
                    domStyle.set(closeBtnWrapper, "right","5px");
                    domStyle.set(closeBtnWrapper, "text-align","right");
                    domStyle.set(closeBtnWrapper, "width","40px;");

                    var emptySpace= dojo.create("div", null , messageDialog.domNode);
                    domStyle.set(emptySpace,"height","10px");
                    var closeBtnNode = dojo.create("div", null , closeBtnWrapper);
                    var closeBtnDijit = new dijit.form.Button({label: "OK",
                                                   onClick: function() {
                                                       messageDialog.hide();
                                                       messageDialog.destroy();
                                                       dojo.empty(messageNode);
                                                   }
                                                },
                                                closeBtnNode);
                    messageDialog.show();
*/
                }
            }
        } else {
            //only for testing purposes
            this.logTestMessage(message);
        }
    },

    /*
         ******************************************************************************************************
         * handles XForms xforms-out-of-range events
         ******************************************************************************************************
     */
    _handleOutOfRange:function(xmlEvent) {
        /*
         var message = "Value for ui control '" + xmlEvent.contextInfo.targetName + "' (id:"+xmlEvent.contextInfo.targetId+") is out of range";
         if(this.webtest != 'true') {
         dijit.byId("betterformMessageToaster").setContent(message,'message');
         dijit.byId("betterformMessageToaster").show();
         }else{
         this.logTestMessage(message);
         }
         */
        var uiControl = dom.byId(xmlEvent.contextInfo.targetId + "-value");
        if (uiControl != undefined) {
            if (domClass.contains(uiControl, "xfInRange")) {
                domClass.remove(uiControl, "xfInRange");
            }
            domClass.add(uiControl, "xfOutOfRange");
        }
    },

    /*
         ******************************************************************************************************
         * handles XForms xforms-in-range events
         ******************************************************************************************************
     */
    _handleInRange:function(xmlEvent) {
        console.debug("XFProcessor._handleInRange xmlEvent:", xmlEvent);
        var uiControl = dom.byId(xmlEvent.contextInfo.targetId + "-value");
        if (uiControl != undefined) {
            if (domClass.contains(uiControl, "xfOutOfRange")) {
                domClass.remove(uiControl, "xfOutOfRange");
            }
            domClass.add(uiControl, "xfInRange");
        }
    },

    /*
     * function for testing purpose to avoid usage of JS alerts that can cause problems with Selenium
     */
    //todo: is this function needed any more???
    logTestMessage:function(message) {
        console.debug("XFProcessor.logTestMessage message:", message);
        var log = dom.byId('messageLog');
        if (!log) {
            log = document.createElement('div');
            log.id = 'messageLog';
            document.body.appendChild(log);
        }
        var messageDiv = document.createElement('message');
        messageDiv.id = 'message' + ( this._countMessages(log) + 1);
        var messageText = document.createTextNode(message);
        messageDiv.appendChild(messageText);
        log.appendChild(messageDiv);
    },

    //todo: is this function needed any more???
    _countMessages:function (log) {
        console.debug("XFProcessor.logTestMessage message:", log);
        var logMessagesCount = log.getElementsByTagName('message').length;
        return logMessagesCount;
    },

    //todo: probably to be merged with '_handleSubmitDone'?
    _handleBetterFormReplaceAll:function() {
        console.debug("XFProcessor._handleBetterFormReplaceAll");
        fluxProcessor.skipshutdown = true;

        // add new parameter (params are located before the anchor sign # in an URI)
        var anchorIndex = window.location.href.lastIndexOf("#");
        var queryIndex = window.location.href.lastIndexOf("?");
        var path = window.location.href;
        if (anchorIndex != -1) {
            path = window.location.href.substring(0, anchorIndex);
        }
        if (queryIndex == -1) {
            path += "?";
        }
        path += "&submissionResponse=true&sessionKey=" + fluxProcessor.sessionKey;
        if (anchorIndex != -1) {
            path += window.location.href.substring(anchorIndex);
        }

        window.open(path, "_self");
    },


    //todo: should be moved into a behavior
    _handleBetterFormDialogOpen:function(/*XMLEvent*/ xmlEvent) {
       console.debug("XFProcessor._handleBetterformDialogOpen: targetId: '",xmlEvent.contextInfo.targetId,"' parentId: " , xmlEvent.contextInfo.parentId);
       var xfControlId =xmlEvent.contextInfo.targetId;
       // if XForms Control Dijit allready exists call show on selected control
       if(dijit.byId(xfControlId) != undefined){
            dijit.byId(xfControlId).show();
       }else {
            console.error("error during betterform-dialog-show-event: targetId '",xmlEvent.contextInfo.targetId, "', xfControlId: '", xfControlId,"' does not exist");
       }
    },

    //todo: should be moved into a behavior
    _handleBetterFormDialogClose:function(/*XMLEvent*/ xmlEvent) {
       console.debug("XFProcessor._handleBetterformDialogClose: targetId: '",xmlEvent.contextInfo.targetId,"' parentId: " , xmlEvent.contextInfo.parentId);
       var xfControlId =xmlEvent.contextInfo.targetId;
       // if XForms Control Dijit allready exists call hide on selected control
       if(dijit.byId(xfControlId) != undefined){
            dijit.byId(xfControlId).hide();
       }else {
            console.error("error during betterform-dialog-hide-event: targetId '",xmlEvent.contextInfo.targetId,"' does not exist");
       }
    },


    _handleBetterFormStateChanged:function(/*XMLEvent*/ xmlEvent) {
        console.debug("XFProcessor._handleBetterFormStateChanged: targetId: " + xmlEvent.contextInfo.targetId , " xmlEvent: " , xmlEvent);


        // new implementation code
        //todo: review - control specific code should be here!
        var parentId = xmlEvent.contextInfo.parentId;
        if(parentId) {
            var parentNode = dom.byId(parentId);
            // console.debug("XFProcessor._handleBetterFormStateChanged: parentNode: ",parentNode);
            if (domClass.contains(parentNode, "xfSelectorItem")) {
                var selectParentId = domAttr.set(parentNode.parentNode, "id");
                if(domClass.contains(parentNode.parentNode,"xfRadioItemset")){
                    selectParentId =domAttr.set(parentNode.parentNode.parentNode,"id");
                }
                // console.debug("XFProcessor._handleStateChanged: selectParentId: ",selectParentId);
                if(dijit.byId(selectParentId)) {
                    dijit.byId(selectParentId).handleStateChanged(xmlEvent.contextInfo);
                    return;
                }
            }
        }

         /*
         console.debug("XFProcessor._handleStateChanged this:", this,
         "\n\txmlEvent: ",xmlEvent,
         "\n\tcontextInfo: ",xmlEvent.contextInfo,
         "\n\tparentId: ",xmlEvent.contextInfo.parentId,
         "\n\ttargetId: ",xmlEvent.contextInfo.targetId,
         "\n\tvalue: ",xmlEvent.contextInfo.value,
         "\n\ttargetName: ",xmlEvent.contextInfo.targetName,
         "\n\tmip:readonly: ",xmlEvent.contextInfo.readonly,
         "\n\tmip:required: ",xmlEvent.contextInfo.required,
         "\n\tmip:valid: ",xmlEvent.contextInfo.valid,
         "\n\tmip:enabled: ",xmlEvent.contextInfo.enabled
         );

         */

        var xfControlId = xmlEvent.contextInfo.targetId;

        /**
         *
         * If:  StateChange Target is a XForms Repeat
         *
         * **/
        if (xmlEvent.contextInfo.targetName != undefined && xmlEvent.contextInfo.targetName == "repeat") {
            // console.debug("XFProcessor._handleBetterFormStateChanged for Repeat");
            var repeat = this._getRepeatObject(xfControlId);
            if (repeat != undefined) {
                repeat.handleStateChanged(xmlEvent.contextInfo);
            }
            else if (repeat == undefined) {
                console.error("Repeat [id:'", xfControlId, "'] does not exist");
            }
        }
        else if (xmlEvent.contextInfo.targetName != undefined && xmlEvent.contextInfo.targetName == "group") {
            // console.debug("XFProcessor._handleBetterFormStateChanged for Group");
            var group = dijit.byId(xmlEvent.contextInfo.targetId);

            if (group == undefined && dom.byId(xmlEvent.contextInfo.targetId) != undefined) {
                // console.debug("creating new Group: ",dom.byId(xmlEvent.contextInfo.targetId));
                // TODO: Lars: new implementation needed
                // dojo.require("betterform.ui.container.Group");
                // group = new betterform.ui.container.Group({}, dom.byId(xmlEvent.contextInfo.targetId));
            }
            /* group markup does not exist in ui, check if targetid references an repeatItem */
            else if (xmlEvent.contextInfo.targetId != undefined) {
                // console.debug("creating new Group (xmlEvent.contextInfo.targetId = undefined) : ",xmlEvent.contextInfo.targetId);
                var repeatItemNode = query("*[repeatItemId='" + xmlEvent.contextInfo.targetId + "']")[0];
                if (repeatItemNode != undefined && domClass.contains(repeatItemNode, "xfRepeatItem")) {
                    var repeatNode = repeatItemNode.parentNode;
                    console.debug("repeat: ",repeatNode);
                    group = dijit.byId(repeatNode.id);
                }
            }
            if (group != undefined) {
                group.handleStateChanged(xmlEvent.contextInfo);
            } else {
                console.warn("XFProcessor._handleBetterFormStateChanged: don't know how to handle xmlEvent: ", xmlEvent, " for target: " + xmlEvent.contextInfo.targetId + " [", xmlEvent.contextInfo.targetName, "]");
            }
        }
        // HANDLING XF:COPY FOR ALL SELECTS
        else if (xmlEvent.contextInfo.targetName != undefined && xmlEvent.contextInfo.targetName == "select1" && xmlEvent.contextInfo.copyItem != undefined) {
            // console.debug("XFProcessor._handleBetterFormStateChanged xf:copy handling: xmlEvent: ",xmlEvent, " contextInfo: ", xmlEvent.contextInfo);
            var warningMsgXFCopy = "XFProcessor._handleBetterFormStateChanged: Select1 ControlValue " + xmlEvent.contextInfo.targetId + "-value: No item selected"
            var select1 = dom.byId(xmlEvent.contextInfo.targetId + "-value");
            if (select1 != undefined) {
                var selectedItemId = xmlEvent.contextInfo.selectedItem;
                // console.debug("XFProcessor._handleBetterFormStateChanged xf:copy: selectedItem: ", selectedItemId);
                if (selectedItemId != undefined && selectedItemId != "") {
                    var selectItems = query(".xfSelectorItem", select1);
                    var itemSelected = false;
                    for (var i = 0; i < selectItems.length; i++) {
                        if (domAttr.get(selectItems[i], "id") == selectedItemId) {
                            // console.debug("SelectedItem: ", selectItems[i]);
                            select1.selectedIndex = (i);
                            itemSelected = true;
                        }
                    }
                    if (!itemSelected) {
                        console.warn(warningMsgXFCopy);
                    }
                }
                else {
                    console.warn(warningMsgXFCopy);
                }
            } else {
                console.warn(warningMsgXFCopy);
            }
        }

        /**
         *
         * Else If:  XForms Control Dijit allready exists call handleStateChanged on selected control
         *
         * **/
        else if (dijit.byId(xfControlId) != undefined) {
            // console.debug("XFProcessor.handleStateChanged on existing Dijit [id: " + xfControlId + ", / object:",dijit.byId(xfControlId),+"]");
            var xfControlDijit = dijit.byId(xfControlId);
            // console.debug("_handleBetterFormStateChanged: ", xfControlDijit, " xmlEvent.contextInfo:",xmlEvent.contextInfo);
            xfControlDijit.handleStateChanged(xmlEvent.contextInfo);
        }
        /**
         *
         * Else If: XForms Control Dijit does not yet exist but a DOM Prototype Template is allready present
         *          represent state-changed-events directly after betterform-item-inserted event
         *
         * **/

        // TODO: old code to initialize controls after insert, happens with "apply behaviour" now
        /**
        else if (dom.byId(xfControlId) != undefined) {
            // console.debug("XFProcessor.handleStateChanged on existing DOM  [id: " + xfControlId + ", / xmlEvent:",xmlEvent,+"]");
            var controlNodeCreated = new betterform.ui.Control({contextInfo:xmlEvent.contextInfo}, dom.byId(xfControlId));
            if(controlNodeCreated.handleStateChanged) {
                controlNodeCreated.handleStateChanged(xmlEvent.contextInfo);
            }else  {
                console.warn("controlNodeCreated.handleStateChanged does not exist for widget ", controlNodeCreated);
            }

        } **/

        /**
         *
         * Else If: No XForms Control for the given id exist at all, e.q. inserting into repeats / itemsets,
         *          Algorithm relies on parent id of the given XForms Control
         * **/


        else if (xmlEvent.contextInfo.parentId != undefined && xmlEvent.contextInfo.parentId != "") {
            // console.debug("XFProcessor.handleStateChanged: xmlEvent.contextInfo.parentId = " + xmlEvent.contextInfo.parentId);
            var parentDijit = dijit.byId(xmlEvent.contextInfo.parentId);
            // parent dijit does exist and executes handleStateChanged
            if (parentDijit != undefined) {
                // console.debug("XFProcessor.handleStateChanged(ParentDijit" + parentDijit.id + ") no control found, execute handle state change on parent");
                parentDijit.handleStateChanged(xmlEvent.contextInfo);
            }
            // parent dijit does not(!!) exist yet
            else {
                var parentControlNode = dom.byId(xmlEvent.contextInfo.parentId);
                if (parentControlNode == undefined) {
                    console.error("XFProcessor betterform-state-changed  Warning: Neither Target nor its Parent does exist [xmlEvent", xmlEvent, "]");
                }
                //  special handling for Select controls, check if parent node is selector item
                else if (domClass.contains(parentControlNode, "xfSelectorItem")) {
                    // console.debug("XFProcessor.handleStateChanged Target Node does not exist, Parent Control is SelectorItem (ParentSelector:" , parentControlNode , ")");
                    var selectParentId = domAttr.get(parentControlNode.parentNode, "id");
                    if(dijit.byId(selectParentId)) {
                        dijit.byId(selectParentId).handleStateChanged(xmlEvent.contextInfo);
                    }else if (parentControlNode){
                        // DIJIT COULD NOT BE FOUND - SEARCH FOR PROTOTYPE SELECT OPTIONS
                        // console.debug("found Selector Item Node: ",parentControlNode);
                        if(xmlEvent.contextInfo.targetName == "label") {
                            // console.debug("Update label of option - value: ",xmlEvent.contextInfo.value);
                            parentControlNode.innerHTML = xmlEvent.contextInfo.value;
                        }
                        else if(xmlEvent.contextInfo.targetName == "value") {
                            // console.debug("Update value of option - value: ",xmlEvent.contextInfo.value);
                            domAttr.set(parentControlNode,"value",xmlEvent.contextInfo.value);
                        }else {
                            console.warn("XFProcessor betterform-state-changed: : error updating xfSelector item ",xmlEvent.contextInfo);
                        }
                    }else {
                        console.warn("XFProcessor betterform-state-changed: : can't find xfSelectorItem ", selectParentId);
                    }
                }
                else {
                    console.warn("XFProcessor betterform-state-changed: No handleStateChanged implementation availabled for contextinfo: ", xmlEvent.contextInfo);
                }
            }
        }
        // Check if it is a nested output in a trigger label. If so, (really quick hack: chance xmlEvent.contextInfo)
        else if(xmlEvent.contextInfo.targetName != undefined  && xmlEvent.contextInfo.targetName == "output"){
            // console.debug("XFProcessor._handleBetterFormStateChanged xf:output inside label handling: xmlEvent: ",xmlEvent, " contextInfo: ", xmlEvent.contextInfo);

	        var possibleId = xmlEvent.contextInfo.targetId.substring(1,xmlEvent.contextInfo.targetId.length) -2 ;
            var warningMsg = "XFProcessor._handleBetterFormStateChanged: element for dynamic label " + xmlEvent.contextInfo.targetId + ": Control not found ";
	        var control = dijit.byId("C"+possibleId);
	        if ((control != undefined) && (control.controlType == "trigger")) {
                // console.debug("XFProcessor._handleBetterFormStateChanged for dynamic label on trigger control: " ,control, "controlType: ", control.controlType);
		        xmlEvent.contextInfo.targetId = "C"+(possibleId-1);
		        xmlEvent.contextInfo.parentId = "C"+(possibleId-2);
		        xmlEvent.contextInfo.targetName = "label";
                control.handleStateChanged(xmlEvent.contextInfo);
            } else if (control != undefined) {
		        // There was a dijit, so currently assuming it is either an output, input or group. Try setting it...
		        // target ID does not change, parent does
                // console.debug("XFProcessor._handleBetterFormStateChanged input/output/group control: " ,control, "controlType: ", control.controlType);
		        xmlEvent.contextInfo.parentId = "C"+(possibleId);
		        xmlEvent.contextInfo.targetName = "label";
                control.handleStateChanged(xmlEvent.contextInfo);
  	        } else {
		        // Currently the only case encountered where this is needed is for a selectorItem
	            control = dom.byId("C"+possibleId-2);
	            if (control != undefined) {
                    // console.debug("XFProcessor._handleBetterFormStateChanged selectorItem control: " ,control, "controlType: ", control.controlType);
		            // targetId stays the same
		            xmlEvent.contextInfo.targetName = "label";
		            xmlEvent.contextInfo.parentId = "C"+(possibleId-2);
                    this._handleBetterFormStateChanged(xmlEvent);
	    	    } else {
	 	            console.warn(warningMsg);
		        }
	        }
	    } else {
            console.error("XFProcessor betterform-state-changed Error: Processor does not know how to handle betterform-state-changed based on xmlEvent ", xmlEvent.contextInfo.targetId);
        }

    },


    //todo: should be moved to a behavior
    //todo: note that xforms-insert might not target repeat or itemset
    _handleBetterFormInsertRepeatItem:function(xmlEvent) {
        console.debug("XFProcessor.betterform-insert-repeatitem [id: '", xmlEvent.contextInfo.targetId, "'] xmlEvent:",xmlEvent);
        var repeatToInsertIntoDOM = query("*[repeatId='" + xmlEvent.contextInfo.targetId + "']");

        var repeatObject = this._getRepeatObject(xmlEvent.contextInfo.targetId);
        if (repeatObject == undefined) {
            // console.debug("XFProcessor._handleBetterFormInsertRepeatItem ",repeatToInsertIntoDOM);
            // console.dirxml(repeatToInsertIntoDOM[0]);
            // TODO: Lars: new implementation needed
            // dojo.require("betterform.ui.container.Repeat");
            // repeatObject = new betterform.ui.container.Repeat({}, repeatToInsertIntoDOM[0]);
        }
        repeatObject.handleInsert(xmlEvent.contextInfo);

    },

    //todo: should be moved to a behavior
    _handleBetterFormInsertItemset:function(xmlEvent) {
        console.debug("betterform-insert-itemset [id: '", xmlEvent.contextInfo.targetId, " / contextInfo:",xmlEvent.contextInfo,']' );
        var selectDijit = dijit.byId(xmlEvent.contextInfo.parentId + "-value");
        console.debug("betterform-insert-itemset [selectDijit: '", selectDijit ,']' );

        if (selectDijit != undefined) {
            selectDijit.handleInsertItem(xmlEvent.contextInfo);
        }
        // OLD CODE
/*
        if (dijit.byId(xmlEvent.contextInfo.targetId) != undefined) {
            // console.debug("betterform-insert-itemset handle Insert [id: '", xmlEvent.contextInfo.targetId, " / dijit:",dijit.byId(xmlEvent.contextInfo.targetId),']' );
            dijit.byId(xmlEvent.contextInfo.targetId).handleInsert(xmlEvent.contextInfo);
        } else {
            var itemsetDOM = dom.byId(xmlEvent.contextInfo.targetId);
            // console.debug("betterform-insert-itemset [id: '", xmlEvent.contextInfo.targetId, " / dom:'",dom.byId(xmlEvent.contextInfo.targetId),"']");
            var itemsetType = domAttr.get(itemsetDOM, "dojoType");
            // Prototypes don't have a dojoType, search for controlType instead
            if(itemsetType == undefined) {
                var controlType = domAttr.get(itemsetDOM, "controlType");
                if(controlType == "optGroup") {
                    itemsetType = "betterform.ui.select.OptGroup";
                }
            }

            var itemsetDijit;
            if(itemsetType != undefined) {
                if (itemsetType == "betterform.ui.select.OptGroup") {
                    itemsetDijit = new betterform.ui.select.OptGroup({contextInfo:xmlEvent.contextInfo}, itemsetDOM);
                }
                else if (itemsetType == "betterform.ui.select1.RadioItemset") {
                    itemsetDijit = new betterform.ui.select1.RadioItemset({contextInfo:xmlEvent.contextInfo}, itemsetDOM);
                }
                else if (itemsetType == "betterform.ui.select.CheckBoxItemset") {
                    itemsetDijit = new betterform.ui.select.CheckBoxItemset({contextInfo:xmlEvent.contextInfo}, itemsetDOM);
                }
                else {
                    console.warn("XFProcessor apply betterform-insert-itemset: Itemset Type " + itemsetType + " not supported yet");
                }
            } else {
                console.warn("XFProcessor apply betterform-insert-itemset: ItemSet Type is null");
                return;
            }
            // console.debug("betterform-insert-itemset [id: '", xmlEvent.contextInfo.targetId, " / dojotype:'",itemsetType,"']");
            if (itemsetDijit != undefined) {
                itemsetDijit.handleInsert(xmlEvent.contextInfo);
            } else {
                console.warn("XFProcessor apply betterform-insert-itemset: Error during itemset creation: ItemsetId " + xmlEvent.contextInfo.targetId + " itemsetType: " + itemsetType + " not supported yet");
            }
        }
*/

    },
    _handleBetterFormItemDeleted:function(xmlEvent) {
        console.debug("handle betterform-item-deleted for ", xmlEvent.contextInfo.targetName, " [id: '", xmlEvent.contextInfo.targetId, "'] xmlEvent:", xmlEvent);
        if (xmlEvent.contextInfo.targetName == "itemset") {
            var selectDijit = dijit.byId(xmlEvent.contextInfo.parentId + "-value");
            console.debug("handle betterform-item-deleted [selectDijit: '", selectDijit ,']' );
            if (selectDijit != undefined) {
                selectDijit.handleDeleteItem(xmlEvent.contextInfo);
            }
        }

        // OLD CODE
/*
        if (xmlEvent.contextInfo.targetName == "itemset") {
            dijit.byId(xmlEvent.contextInfo.targetId).handleDelete(xmlEvent.contextInfo);
        }
        else if (xmlEvent.contextInfo.targetName == "repeat" || xmlEvent.contextInfo.targetName == "tbody") {
            var repeatObject = _getRepeatObject(xmlEvent);
            repeatObject.handleDelete(xmlEvent.contextInfo);
            var positionOfDeletedItem = xmlEvent.contextInfo.position;
            if(positionOfDeletedItem <= repeatObject._getSize()){
                repeatObject._handleSetRepeatIndex(positionOfDeletedItem);
            }
        }
*/
    },

    //todo: move to repeat behavior
    _handleBetterFormIndexChanged:function(xmlEvent) {
        console.debug("XFProcessor._handleBetterFormIndexChanged xmlEvent:",xmlEvent);
        var repeat = this._getRepeatObject(xmlEvent.contextInfo.targetId);
        console.debug("XFProcessor.betterform-index-changed Repeat: ", repeat, " targetId: ", xmlEvent.contextInfo.targetId);
        repeat.handleSetRepeatIndex(xmlEvent.contextInfo);
    },


    _getRepeatObject: function (targetId){
        console.debug("XFProcessor._getRepeatObject targetId:",targetId);        
        var repeatElement = query("*[repeatId='" + targetId + "']");
        var repeatObject = dijit.byId(domAttr.get(repeatElement[0], "id"));
        return repeatObject;
    },

    _handleUploadProgressEvent:function(xmlEvent) {
        console.debug("XFProcessor._handleUploadProgressEvent: xmlEvent:",xmlEvent);
        var xfControlId = xmlEvent.contextInfo.targetid;
        // if XForms Control Dijit allready exists call handleStateChanged on selected control
        if (dijit.byId(xfControlId) != undefined) {
            dijit.byId(xfControlId).updateProgress(xmlEvent.contextInfo.progress);
        } else {
            console.error("error during upload-progress-event: targetId " + xmlEvent.contextInfo.targetId + " does not exist");
        }
    },
    _handleXFormsFocus:function(xmlEvent) {
        console.debug("xforms-focus xmlEvent: ", xmlEvent);
        try {
            var targetName = xmlEvent.contextInfo.targetName;
            if (targetName != "group" && targetName != "repeat" && targetName != "switch" && targetName != "case") {
                var controlToFocus = dijit.byId(xmlEvent.contextInfo.targetId + "-value");
                if(controlToFocus && controlToFocus.focus){
                   controlToFocus.focus();
                }else if(dom.byId(xmlEvent.contextInfo.targetId)){
                    console.warn("Control is no dijit, focusing domNode: " + xmlEvent.contextInfo.targetId );
                    controlToFocus.domNode.focus();
                }else {
                    console.warn("Control " + xmlEvent.contextInfo.targetId + " does not exist");
                }
            }
        }
        catch(ex) {
            fluxProcessor._handleExceptions("error during xforms-focus: targetId " + xmlEvent.contextInfo.targetId + " does not exist - Exception:", ex);
        }

    },

    _handleDOMFocusIn:function(xmlEvent) {
        console.debug("XFProcessor._handleDOMFocusIn xmlEvent:",xmlEvent);
        xfControlId = xmlEvent.contextInfo.targetId + "-value";
        if (dijit.byId(xfControlId) != undefined) {
        	// console.debug("dom-focus-in-dijit control: ",xfControlId);
            dijit.byId(xfControlId)._handleDOMFocusIn();
        } else if (dom.byId(xfControlId) != undefined) {
        	// console.debug("dom-focus-in-dojo control: ",xfControlId);
            var domControlValue = dom.byId(xfControlId);
            domControlValue.focus();
        } else {
            console.warn("XFProcessor._handleDOMFocusIn no Element found for id:", xfControlId, " might have been destroyed");
        }
    },

    _handleXFormsHint:function(xmlEvent) {
        console.debug("XFProcessor._handleXFormsHint xmlEvent:",xmlEvent);
        var xfControlId = xmlEvent.contextInfo.targetId;
        var message = domAttr.get(dom.byId(xfControlId + "-value"), "title");
        dijit.byId("betterformMessageToaster").setContent(message, 'message');
        dijit.byId("betterformMessageToaster").show();
        if (this.webtest == 'true') {
            //only for testing purposes
            this.logTestMessage(message);
        }
    },

    _handleShowHelp:function(xmlEvent) {
        console.debug("XFProcessor._handleShowHelp xmlEvent:",xmlEvent);
        fluxProcessor.currentControlId = xmlEvent.contextInfo.targetId;
        fluxProcessor.showHelp();
    },

    _handleLinkException:function(xmlEvent) {
        console.debug("XFProcessor._handleLinkException xmlEvent:",xmlEvent);
        if (this.webtest != 'true') {
            console.error("Fatal error - " + xmlEvent.type + ": Failed to load resource: " + xmlEvent.contextInfo.resourceUri);
        } else {
            //only for testing purposes
            fluxProcessor.logTestMessage("Fatal error - " + xmlEvent.type + ": Failed to load resource: " + xmlEvent.contextInfo.resourceUri);
        }
        //        fluxProcessor.closeSession();
    },

    _handleSwitchToggled:function(xmlEvent) {
        console.debug("XFProcessor._handleSwitchToggled xmlEvent:", xmlEvent);
        var tmpSwitch = dijit.byId(xmlEvent.contextInfo.targetId);
        if (tmpSwitch == undefined && dom.byId(xmlEvent.contextInfo.targetId) != undefined) {
            // console.debug("create new switch: ", xmlEvent);
            // TODO: Lars: new implementation needed
            // dojo.require("betterform.ui.container.Switch");
            // tmpSwitch = new betterform.ui.container.Switch({}, dom.byId(xmlEvent.contextInfo.targetId));
        }
        tmpSwitch.toggleCase(xmlEvent.contextInfo);
    },

    fetchProgress:function(id, fileName) {
        console.debug("XFProcessor.fetchProgress id:", id);
        try {
            console.debug("XFProcessor.fetchProgress id:", id, "fileName: " , fileName , " this.sessionKey:", this.sessionKey);
            Flux.fetchProgress(id, fileName, this.sessionKey, this.applyChanges);
        }
        catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux.fetchProgress", ex);
        }
    },

    /*
     @param: String locale
     */

    setLocale:function(locale) {
        console.debug("XFProcessor.setLocale: Changed locale to: " + locale);
        try {
            Flux.setLocale(locale, this.sessionKey, this.applyChanges);
        }
        catch(ex) {
            fluxProcessor._handleExceptions("Failure executing Flux.setLocale", ex);
        }
    },

    showHelp:function(id) {
        console.debug("showng help for:", id);


        var helpCtrl = dom.byId(id + '-help');
        if (helpCtrl == undefined) {
            console.warn("No help available for Control Id: '" + id + "'");
            return;
        }

        var helpText = dom.byId(id + "-help-text");
        var currentState = domStyle.get(helpText,"display");

        if(currentState == "none"){
            domStyle.set(helpText, "display","inline-block");
        }else{
            domStyle.set(helpText, "display","none");
        }
        //make sure that the input control at work does not loose the focus
//        dom.byId(id).focus();
    },

    getInstanceDocument:function(modelId, instanceId){
        console.debug("XFProcessor.getInstanceDocument modeId:", modelId, " instanceId:",instanceId);
        dwr.engine.setErrorHandler(this._handleExceptions);
        Flux.getInstanceDocument(modelId, instanceId, this.sessionKey,this.printInstance);
    },

    printInstance:function(data){
        console.debug("XFProcessor.printInstance data:", data);
        console.dirxml(data);
        dom.byId("debugFrame").innerHTML=data;
    }
    })
});