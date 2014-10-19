angular.module('roadglApp', ['decipher.history']);

angular.module('roadglApp').
controller('AppCtrl', ['$scope', 'History', function ($scope, History) {
	$scope.laneClouds = [];
	// $scope.laneCloudsHistory;
	// History.watch('laneClouds', $scope);
	// var w = History.watch('laneClouds', $scope, {}, { timeout:500 });
	// w.addChangeHandler('myChangeHandler', function() {
	//     console.log("laneClouds got changed");
	// });
}]);
