myApp.
factory('tags', function($http) {

    function load($scope) {
        $http.get("tags?route="+$scope.trackInfo.track).success(function(data) {
            $scope.tags = data;
            var categories = {};
            var scrubberWidth = document.querySelector("#scrubberDiv").offsetWidth - 60;
            for (var i = 0; i < $scope.tags.length; i++) {
                var tag = $scope.tags[i];
                if (!(tag.category.name in categories)) {
                    categories[tag.category.name] = Object.keys(categories).length * 5;
                }
                var left = Math.round(scrubberWidth * tag.startFrame / $scope.gps.length + 30),
                    right = Math.round(scrubberWidth * tag.endFrame / $scope.gps.length + 30),
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

    return {
        load: load
    };
});
