myApp.
factory('tagEditor', function($http, key) {

    var $scope,
        typeAddBtnIdSuffix = "AddBtn",
        typeContentIdSuffix = "Content",
        vars = {
            tags: null,
            tagLeftVal: 0,
            tagRightVal: 1,
            showForm: ""
        };

    function init(scope) {
        $scope = scope;
        document.getElementById("categoryForm").addEventListener("submit", categorySubmit, false);
        document.getElementById("tagForm").addEventListener("submit", tagSubmit, false);
        load();
    }

    function exit() {
        document.getElementById("categoryForm").removeEventListener("submit", categorySubmit, false);
        document.getElementById("tagForm").removeEventListener("submit", tagSubmit, false);
    }

    function tagLeft() {
        vars.tagLeftVal = parseInt(vars.tagLeftVal, 10);
        if (vars.tagLeftVal > vars.tagRightVal - 1)
            vars.tagLeftVal = vars.tagRightVal - 1;
        $scope.frameCountTemp = vars.tagLeftVal;
        $("#startFrameInput").val(vars.tagLeftVal);
        $scope.flush();
    }

    function tagRight() {
        vars.tagRightVal = parseInt(vars.tagRightVal, 10);
        if (vars.tagRightVal < vars.tagLeftVal + 1)
            vars.tagRightVal = vars.tagLeftVal + 1;
        $scope.frameCountTemp = vars.tagRightVal;
        $("#endFrameInput").val(vars.tagRightVal);
        $scope.flush();
    }

    function load() {
        $http.get("tags?route=" + $scope.trackInfo.track).success(function(data) {
            vars.tags = data;
            var categories = {};
            var scrubberWidth = document.querySelector("#scrubberDiv").offsetWidth - 10;
            for (var i = 0; i < vars.tags.length; i++) {
                var tag = vars.tags[i];
                if (!(tag.category.name in categories)) {
                    categories[tag.category.name] = Object.keys(categories).length * 5;
                }
                var left = Math.round(scrubberWidth * tag.startFrame / $scope.gps.length) + 3,
                    right = Math.round(scrubberWidth * tag.endFrame / $scope.gps.length) + 3,
                    width = Math.max(right - left, 1);
                tag.style = {
                    left: left + "px",
                    width: width + "px",
                    top: -10 - categories[tag.category.name],
                    "background-color": tag.category.displayColor
                };
                tag.popupStyle = {
                    left: -75 + width / 2 + "px",
                };
            }
        });
    }

    // function addBtnShow(event, typeToShow, typeToHide) {
    //     var typeToShowContent = document.getElementById(typeToShow + typeContentIdSuffix);
    //     var typeToShowBtn = document.getElementById(typeToShow + typeAddBtnIdSuffix);
    //     var typeToHideContent = document.getElementById(typeToHide + typeContentIdSuffix);
    //     var typeToHideBtn = document.getElementById(typeToHide + typeAddBtnIdSuffix);
    //     if (typeToShowContent.classList.contains("hidden")) {
    //         typeToHideContent.classList.add("hidden");
    //         typeToHideBtn.classList.remove("selected");
    //         typeToShowContent.classList.remove("hidden");
    //         typeToShowBtn.classList.add("selected");
    //     } else {
    //         typeToShowContent.classList.add("hidden");
    //         typeToShowBtn.classList.remove("selected");
    //     }
    // }

    function applyFormVisibility() {
        // regular ng-show doesn't work on forms... angular bug?
        switch (vars.showForm) {
            case "category":
                document.getElementById("categoryContent").classList.remove("ng-hide");
                document.getElementById("tagContent").classList.add("ng-hide");
                break;
            case "tag":
                document.getElementById("categoryContent").classList.add("ng-hide");
                document.getElementById("tagContent").classList.remove("ng-hide");
                break;
            default:
                document.getElementById("categoryContent").classList.add("ng-hide");
                document.getElementById("tagContent").classList.add("ng-hide");
        }
    }

    function toggleAddCategory() {
        vars.showForm = vars.showForm == "category" ? "" : "category";
        applyFormVisibility();
    }

    function toggleAddTag() {
        vars.showForm = vars.showForm == "tag" ? "" : "tag";
        initializeTagInput();
        applyFormVisibility();
    }

    function initializeTagInput() {
        if (vars.showForm != "tag") return;
        vars.tagLeftVal = $scope.frameCount;
        vars.tagRightVal = $scope.frameCount + 1;
        $("#startFrameInput").val(vars.tagLeftVal);
        $("#endFrameInput").val(vars.tagRightVal);
    }

    function categorySubmit(event) {
        $.ajax({
            url: "/categories",
            type: "POST",
            data: $("#categoryForm").serialize(),
            success: function(newCategory) {
                $scope.log("Saved category!");
                $(".category-input").val("");
                $('#categorySelector').append($('<option/>', {
                    value: newCategory._id,
                    text: newCategory.name
                }));
                vars.showForm = "";
            }
        });
        event.preventDefault();
        return false;
    }

    function tagSubmit(event) {
        $.ajax({
            url: "/tags",
            type: "POST",
            data: $("#tagForm").serialize(),
            success: function(data) {
                load();
                $scope.log("Saved tag!");
                $(".tag-input").val("");
                initializeTagInput();
            }
        });
        event.preventDefault();
        return false;
    }

    function tagDelete(tag) {
        if (!confirm("Are you sure you want to delete this tag?"))
            return;
        $.ajax({
            url: "/deleteTag",
            type: "POST",
            data: {
                tagId: tag._id
            },
            success: function(data) {
                load();
                $scope.log("Deleted tag");
            }
        });
    }

    return {
        init: init,
        load: load,
        tagLeft: tagLeft,
        tagRight: tagRight,
        toggleAddCategory: toggleAddCategory,
        toggleAddTag: toggleAddTag,
        categorySubmit: categorySubmit,
        tagSubmit: tagSubmit,
        tagDelete: tagDelete,
        vars: vars
    };
});