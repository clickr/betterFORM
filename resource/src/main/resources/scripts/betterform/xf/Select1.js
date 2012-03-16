dojo.provide("betterform.xf.Select1");

dojo.declare(
    "betterform.xf.Select1",dijit._Widget,
    {
        getNthSiblingOption:function(position, referenzedNode){
            var siblingNode = referenzedNode;
            var counter = position;
            while(counter != 0) {
                counter -= 1;
                siblingNode = siblingNode.nextSibling;
                console.debug("getNthSiblingOption: siblingNode:",   siblingNode, " position: ",counter);
            }
            return siblingNode;
        }
    }
);
dojo.declare(
    "betterform.xf.Select1Minimal",betterform.xf.Select1,
    {
        handleInsertItem:function(contextInfo) {
            console.debug("betterform.xf.Select1Minimal.handleInsertItem: ", contextInfo);
            var position = contextInfo.position;
            var itemsetId = contextInfo.targetId;
            var generatedItemId =  contextInfo.generatedIds[contextInfo.prototypeId];

            var referenzedNode = dojo.query('option[data-bf-itemset=\"'+ itemsetId + '\"]',this.id)[0];
            if(referenzedNode){
                var item = undefined;
                if(position == 1){
                    item = dojo.create("option", {id:generatedItemId}, referenzedNode, "before");
                    dojo.attr(item, "data-bf-itemset", itemsetId);
                    dojo.removeAttr(referenzedNode, "data-bf-itemset");
                }
                else {
                    var option = undefined;
                    if(position == 2){
                        option = referenzedNode;
                    }else {
                        option = this.getNthSiblingOption(position-2, referenzedNode);
                    }
                    item = dojo.create("option", {id:generatedItemId}, option, "after");
                }
                dojo.addClass(item, "xfSelectorItem");
            }else {
                console.warn("itemset '",itemsetId,"' does not exist for Select1 [id:'",this.id ,"']");
            }
        },

        handleDeleteItem:function(contextInfo) {
            console.debug("Select1Minimal.handleDeleteItem:  contextInfo:",contextInfo);
            var position = contextInfo.position;
            var itemsetId = contextInfo.targetId;

            var referenzedNode = dojo.query('option[data-bf-itemset=\"'+ itemsetId + '\"]',this.id)[0];
            var option2remove = undefined;
            if(referenzedNode){
                if(position == 1){
                    option2remove = referenzedNode;
                } else {
                    option2remove = this.getNthSiblingOption(position-1, referenzedNode);
                }
                this.domNode.removeChild(option2remove);
            }else {
                console.warn("itemset '",itemsetId,"' does not exist for Select1 [id:'",this.id ,"']");
            }
        },

        handleStateChanged:function(contextInfo) {
            var targetName = contextInfo.targetName;
            var option = dojo.byId(contextInfo.parentId);
            if(targetName == "label" && option){
                option.innerHTML = contextInfo.value;
            }else if(targetName == "value" && option){
                dojo.attr(option,"value",contextInfo.value);
            }else {
                console.warn("OptGroup.handleStateChanged: no action taken for contextInfo: ",contextInfo);
            }
        }
    }
);
