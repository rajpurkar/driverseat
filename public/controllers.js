angular.module('roadglApp', []);

angular.module('roadglApp').
controller('AppCtrl', ['$scope', function ($scope) {
	$scope.laneClouds = [];
	// $scope.laneCloudsHistory;
	// History.watch('laneClouds', $scope);
	// var w = History.watch('laneClouds', $scope, {}, { timeout:500 });
	// w.addChangeHandler('myChangeHandler', function() {
	//     console.log("laneClouds got changed");
	// });
}]);
