(function() {
  var localStorageHelper = window.localStorageHelper || {};
  
  localStorageHelper.doesExtensionHaveAssociatedUser = doesExtensionHaveAssociatedUser;
  localStorageHelper.getUserId = getUserId;
  localStorageHelper.setUserId = setUserId;
  localStorageHelper.setUserCache = setUserCache;
  localStorageHelper.getUserCache = getUserCache;

  window.localStorageHelper = localStorageHelper;

  function doesExtensionHaveAssociatedUser() {
    return getUserId();
  }

  function getUserId() {
    return localStorage.userId;
  }

  function setUserId(userId) {
    localStorage.userId = userId;
  }

  function setUserCache(userJsonData) {
    localStorage.userCache = userJsonData;
  }

  function getUserCache() {
    return localStorage.userCache;
  }
})();