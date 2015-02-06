myApp.
factory('tagEditor', function($http, key) {

    var $scope,
        typeAddBtnIdSuffix = "AddBtn",
        typeContentIdSuffix = "Content";

    function init(scope) {
        $scope = scope;
        $scope.tagLeft = tagLeft;
        $scope.tagRight = tagRight;
        $scope.tagLeftVal = 0;
        $scope.tagRightVal = 1;
        $scope.categoryAddBtnShow = categoryAddBtnShow;
        $scope.tagAddBtnShow = tagAddBtnShow;
        document.getElementById("categoryForm").addEventListener("submit", handleCategorySubmit, false);
        document.getElementById("tagForm").addEventListener("submit", handleTagSubmit, false);
        $("#startFrameInput").blur(function() {
            $scope.tagLeftVal = $(this).val();
            tagLeft();
        });
        $("#startFrameInput").keydown(function(e) {
            if (e.keyCode != key.keyMap.enter) return;
            $scope.tagLeftVal = $(this).val();
            tagLeft();
        });
        $("#endFrameInput").blur(function() {
            $scope.tagRightVal = $(this).val();
            tagRight();
        });
        $("#endFrameInput").keydown(function(e) {
            if (e.keyCode != key.keyMap.enter) return;
            $scope.tagRightVal = $(this).val();
            tagRight();
        });
    }

    function tagLeft() {
        $scope.tagLeftVal = parseInt($scope.tagLeftVal, 10);
        if ($scope.tagLeftVal > $scope.tagRightVal - 1)
            $scope.tagLeftVal = $scope.tagRightVal - 1;
        $scope.frameCountTemp = $scope.tagLeftVal;
        $("#startFrameInput").val($scope.tagLeftVal);
        $scope.flush();
    }

    function tagRight() {
        $scope.tagRightVal = parseInt($scope.tagRightVal, 10);
        if ($scope.tagRightVal < $scope.tagLeftVal + 1)
            $scope.tagRightVal = $scope.tagLeftVal + 1;
        $scope.frameCountTemp = $scope.tagRightVal;
        $("#endFrameInput").val($scope.tagRightVal);
        $scope.flush();
    }

    function load() {
        $http.get("tags?route="+$scope.trackInfo.track).success(function(data) {
            $scope.tags = data;
            var categories = {};
            var scrubberWidth = document.querySelector("#scrubberDiv").offsetWidth - 10;
            for (var i = 0; i < $scope.tags.length; i++) {
                var tag = $scope.tags[i];
                if (!(tag.category.name in categories)) {
                    categories[tag.category.name] = Object.keys(categories).length * 5;
                }
                var left = Math.round(scrubberWidth * tag.startFrame / $scope.gps.length) + 3,
                    right = Math.round(scrubberWidth * tag.endFrame / $scope.gps.length) + 3,
                    width = Math.max(right-left, 1);
                tag.style = {
                    left: left+"px",
                    width: width+"px",
                    top: -10 - categories[tag.category.name],
                    "background-color": tag.category.displayColor
                };
                tag.popupStyle = {
                    left: -75 + width / 2 + "px",
                };
            }
        });
    }

    function addBtnShow(event, typeToShow, typeToHide) {
        var typeToShowContent = document.getElementById(typeToShow + typeContentIdSuffix);
        var typeToShowBtn = document.getElementById(typeToShow + typeAddBtnIdSuffix);
        var typeToHideContent = document.getElementById(typeToHide + typeContentIdSuffix);
        var typeToHideBtn = document.getElementById(typeToHide + typeAddBtnIdSuffix);
        if (typeToShowContent.classList.contains("hidden")) {
            typeToHideContent.classList.add("hidden");
            typeToHideBtn.classList.remove("selected");
            typeToShowContent.classList.remove("hidden");
            typeToShowBtn.classList.add("selected");
        } else {
            typeToShowContent.classList.add("hidden");
            typeToShowBtn.classList.remove("selected");
        }
    }

    function categoryAddBtnShow(event){
        addBtnShow(event, "category", "tag");
        $("#tagScrubbers").hide();
    }

    function tagAddBtnShow(event) {
        addBtnShow(event, "tag", "category");
        $("#tagScrubbers").toggle();
        initializeTagInput();
    }

    function initializeTagInput() {
        if ($("#tagScrubbers:visible").length > 0) {
            $scope.tagLeftVal = $scope.frameCount;
            $scope.tagRightVal = $scope.gps.length;
            $("#startFrameInput").val($scope.tagLeftVal);
            $("#endFrameInput").val($scope.tagRightVal);
        }
    }

    function handleCategorySubmit(event) {
        $.ajax({
            url: "/categories",
            type: "POST",
            data: $("#categoryForm").serialize(),
            success: function(newCategory) {
                $scope.log("Saved category!");
                $(".category-input").val("");
                $('#categorySelector').append($('<option/>', {
                    value: newCategory._id,
                    text : newCategory.name
                }));
            }
        });
        event.preventDefault();
        return false;
    }

    function handleTagSubmit(event) {
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

    return {
        init: init,
        load: load
    };
});
