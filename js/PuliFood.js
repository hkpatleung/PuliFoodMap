$(document).bind("mobileinit", function(){
    $.mobile.notesdb = openDatabase("PuliFood", "1.0", "Puli Food Map", 2*1024*1024);
    $.mobile.notesdb.transaction(function (t) {
	    t.executeSql("CREATE TABLE IF NOT EXISTS Food (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,details TEXT NOT NULL, created TEXT NOT NULL, updated TEXT, latitude REAL, longitude REAL);");			
		//
		// 以下的註解可以刪除 Food 資料表，非必要時請勿使用
	    // t.executeSql('DROP TABLE Food');    
		// localStorage.removeItem("loaddata")// 移除 loaddata 才能載入預設的資料
		// ------------------------------------------------------------------
		// 第一次載入預設的 /js/FoodData.js 中的 json 資料
		if (isLoadData==null){  // 第一次載入預設的資料 
			localStorage.setItem("loaddata",true); // 第二次以後不載入預設的料	
  			// 以 js/FoodData.js 建立資料庫
			$.each(FoodData, function(InfoIndex, Info) { 
				var title = Info["title"];
				var details = Info["details"];
				var lat = Info["latitude"];
				var lng = Info["longitude"];
				t.executeSql('INSERT into Food(title, details, created, latitude, longitude) VALUES (?,?,date("now"),?,?);',[title, details, lat, lng]);
		    })
		}
    });	
});

$(function(){
	$('#new').bind('pageshow', getLocation);     // 建立新景點時，先取得目前的緯、經度
	$("#home").bind("pageshow", getTitles);      // 將 title 欄位資料加入 ListView 清單
	$("#btn_insert").bind("click", insertItem);  // 建立新景點
	$("#editItem").bind("click", editItem);      // 切換至修改的頁面
	$("#delete").bind("click", deleteItem);      // 刪除景點
	$("#update").bind("click", updateItem);      // 修改景點資料
	$("#btn_showmap2").bind("click", showmap);   // 顯示地圖
	$("#btn_showhome1").bind("click", showhome); // 顯示美食景點
	$('#btn_route').bind('click', Route);        // 路徑規劃
	$('#btn_search').bind('click', SearchFor);   // 網路搜尋
	$("#end").bind("click", runEnd);             //結束
	$("#display").bind("pageshow", getLocation); // 取得目前 GPS 位置
	$('#mappage').bind('pageshow', getMap);      // 載入地圖和地標
});

var gmap;        // Google Map 地圖
var map_div;     // 要顯示地圖的 div
var opts=[];     // opts.title 、 opts.lat 、opts.lng 分別記錄 「標題、緯度、經度」
var infowindow;  // 點選地標顯示的視窗
var FoodNote={lat:null, lng:null, limit:-1};  // -1 載入全部資料
var isLoadData;
var CurrentGeoPoint={lat:null, lng:null };    // 目前的 GPS 定位點
// 從 localStorage 取得中心點
FoodNote.lat=localStorage.getItem("lat"); 
FoodNote.lng=localStorage.getItem("lng");
// 從 localStorage 取得 loaddata,用以判斷是否是第一次要載入預設的資料
isLoadData=localStorage.getItem("loaddata");

if (FoodNote.lat==null || FoodNote.lng==null ){
	FoodNote.lat=23.96612;  // 開始時，以埔里鎮公所為中心點
	FoodNote.lng=120.96626;
	localStorage.setItem("lat",FoodNote.lat); // 儲存中心點
    localStorage.setItem("lng",FoodNote.lng);
}

function getMap() {  // 顯示地圖和地標
    // 移到目前定位點
	var marker=[];
	map_div = document.getElementById("map_div");
	var latlng = new google.maps.LatLng(FoodNote.lat,FoodNote.lng); //取得目前定位點
	gmap = new google.maps.Map(map_div, {
		zoom:15,
		center: latlng,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	});   
	//在地標上加入事件
	$.mobile.notesdb.transaction(function(t) {
	    t.executeSql("SELECT id, title,details,latitude,longitude FROM Food ORDER BY id DESC LIMIT ?", [FoodNote.limit], function(t, result) {
		var len = result.rows.length, row,i;
		if (len > 0 ) {			
			for (i = 0; i < len; i += 1) {
				row = result.rows.item(i);					
				// 加入已建立的地標					
				var latlng = new google.maps.LatLng(row.latitude,row.longitude);
				// 顯示地圖
				var mess=row.title + "</br>" + row.details;
				marker[i] = new google.maps.Marker({
				    position: latlng,
				    map: gmap,
					icon: "images/mapmarker.png",
				    title: mess
				});	
				// 觸碰標記時的事件
				google.maps.event.addListener(marker[i], "click", function(event) {	
					// 以 event.latLng.lng() 、event.latLng.lng() 取得的值和資料庫的值完全不相同，故改用距離來判斷				
					var lat=event.latLng.lat();  
					var lng=event.latLng.lng(); 
					// 取得按下的地標
					$.mobile.notesdb.transaction(function(t) {			
						t.executeSql("SELECT id, title,details,latitude,longitude FROM Food ORDER BY id DESC LIMIT ?",
						 [FoodNote.limit], function(t, result2) {
							// 將目前地標的經緯度和資料庫的景點比對，如果距離 < 1 公尺，即是正確位置 
							if (result2.rows.length>0){  					  
								for (j= 0; j < result2.rows.length; j += 1) {
									 var row = result2.rows.item(j);
									 var disp=getDistance(lat,lng,row.latitude,row.longitude); // 計算地球上兩點的距離
									 // 按下顯示景點資訊，以 displayNote(id) 顯示此景點資訊
									 var showdata='<div class="title"><a onclick="displayNote(' +                                         "'" + row.id + "');" + '">' + row.title + '</a></div>'
									 // 距離 < 1 公尺，在目前的位置開啟 infowindow 視窗 
									 if (disp<0.001) { 
										 infowindow = new google.maps.InfoWindow({   
											 content: showdata
										 });
										 infowindow.open(gmap,marker[j]);				
									 } // end of if (disp<0.001)
								 }    // end of for (j=0;)
							 }         // end of if (result2.rows.length>0)
						})	// end of t.executeSql				
					});	    // end of $.mobile.notesdb		
				});	// end of google.maps.event.addListener
			 }      // end of for (i = 0; i < len; i += 1)   
		  }  // end of if (len > 0 )
	  });    // end of  t.executeSql
   });       // end of $.mobile.notesdb
}            // end of function getMap()

// 將資料庫中的 title 欄位加入 ListView 清單中
function getTitles() {
	var listTitle = $("#recent");
	var items = [];
	$.mobile.notesdb.transaction(function(t) {
		t.executeSql("SELECT id, title,details,latitude,longitude FROM Food ORDER BY id DESC LIMIT ?", [FoodNote.limit], function(t, result) {			    
				var i, len = result.rows.length,row;
				if (len > 0 ) {
					for (i = 0; i < len; i += 1) {
						row = result.rows.item(i);
					    items.push("<li><a href='#display' data-trnote='" + row.id + "'>"
						 + row.title + "</a></li>");						
					}
					listTitle.html(items.join('\n'));
					listTitle.listview("refresh");
					// 設定按下 ListView 清單的事件,將 data-trnote 屬性值當作參數傳遞給 getItem()函式，並切換至 display 頁面			
					$("a",listTitle).bind("click", function(e) {					
						getItem($(this).attr("data-trnote"));
					});
			    }
		 })	 // end of t.executeSql
	}); // end of $.mobile.notesdb
}

// 依 id 取得該筆資料
function getItem(id) {
	$.mobile.notesdb.transaction(function(t) {		
		t.executeSql("SELECT * FROM Food WHERE id = ?", [id], function(t, result) {
			var row = result.rows.item(0), created = convertDateToMDY(row.created),	updated = row.updated;
			$("#display h1").text(row.title);
			$("#showdetail").html("<p>" + row.details + "</p>");
			if (row.latitude != null && row.longitude != null) {				
				opts.title = row.title;
				opts.lat = row.latitude;
				opts.lng = row.longitude;
				$("#btn_showmap3").unbind("click"); // 為避免誤動作，先移除繫結再重新設定繫結
				$("#btn_showmap3").click(opts, displayMap);
			}
			$("#createtime").html("建立時間：" + created);
			if (updated != null){
				updated = convertDateToMDY(updated);
				$("#updatetime").html("更新時間：" + updated );
			}
			$("#delete, #update").attr("data-trnote", id);
			$("#title2").val(row.title);
			$("#details2").val(row.details);
			$("#latitude2").val(row.latitude);
			$("#longitude2").val(row.longitude);
		})
	});
}

function showmap() {  // 顯示地圖
	$.mobile.changePage("#mappage", "slide", false, true);	
	e.preventDefault();  // 避免重複觸發
}

function showhome() {  // 顯示美食景點
	$.mobile.changePage("#home", "slide", false, true);	
	e.preventDefault();  // 避免重複觸發
}

function displayNote(id) { // 在圖標上 按下顯示景點資訊，顯示此景點資訊
	infowindow.close();    // 先關閉 infowindow 視窗
	$.mobile.changePage("#display", "slideup", false, true);	
	getItem(id);  // 顯示美食景點
}

function editItem() {  // 切換至修改的頁面
	$.mobile.changePage("#editNote", "slideup", false, true);
}

function insertItem(e) { // 新增一個景點資料
	var title = $("#title").val();
	var details = $("#details").val();
	var lat=$("#latitude").val();
	var lng=$("#longitude").val();
   	// 資料驗證成功才新增	
	if (title==""){
		alert("必須輸入景點名稱!");
		$("#title").focus();
		return false;
		e.preventDefault();	
	}else if (details==""){
		alert("必須輸入景點資訊!");
		$("#details").focus();
		return false;
		e.preventDefault();		
	}else{
		$.mobile.notesdb.transaction(function(t) {
			t.executeSql('INSERT into Food(title, details, created, latitude, longitude) VALUES (?,?,date("now"),?,?);',
			[title, details, lat, lng],
			function() {
				$.mobile.changePage("#home", "slide", false, true);	//換頁並清除輸入欄位
				$("#title").val("");
				$("#details").val("");
				$("#latitude").val("");
				$("#longitude").val("");
			}, 
			null);
		});
		e.preventDefault();
	}
};

function updateItem(e) {  // 修改指定 id 的資料
	var title = $("#title2").val();
	var details = $("#details2").val();
	var	id = $(this).attr("data-trnote");
	var	latitude = $("#latitude2").val();
	var	longitude = $("#longitude2").val();
	$.mobile.notesdb.transaction(function(t) {
		t.executeSql('UPDATE Food SET title = ?, details = ?, updated = date("now"), latitude=?, longitude=? WHERE id = ?',
		    [title, details, latitude, longitude, id],
			$.mobile.changePage("#home", "flip", false, true),
			null);
	});
	e.preventDefault();
}

function deleteItem(e) {  // 刪除指定 id 的資料
	var flagConfirm=confirm("是否確定刪除？"); 
	if(flagConfirm) { 
		var id = $(this).attr("data-trnote");
		$.mobile.notesdb.transaction(function(t) {
			t.executeSql("DELETE FROM Food WHERE id = ?", [id],
			$.mobile.changePage("#home", "slide", false, true),	null);
		});
		e.preventDefault();
	}
}

function displayMap(e) {  // 以目前定位為中心顯示地圖
	FoodNote.lat=e.data.lat;  
	FoodNote.lng=e.data.lng;
	showmap(); // 顯示地圖和地標
}

function getLocation() { // 取得目前的定位點
	navigator.geolocation.getCurrentPosition(locSuccess, locFail, {enableHighAccuracy:true});
}

function locSuccess(position) {  // 執行成功會取得目前的定位點
	$("#latitude").val(position.coords.latitude);
	$("#longitude").val(position.coords.longitude);
	CurrentGeoPoint.lat=position.coords.latitude; 
	CurrentGeoPoint.lng=position.coords.longitude;
    return true;
}

function locFail(error){     // 執行失敗
	var message="無法取得 GPS 位置！";
	try{
		navigator.notification.alert(messqage, null, "Geolocation");
	}catch(e){
		alert(message);
	}
}

function convertDateToMDY(date) {  // 傳回 月/日/年 日期格式
	var d = date.split("-");
	return d[1] + "/" + d[2] + "/" + d[0];
};

function Route(){  
   // getLocation(); // 取得目前 GPS 位置
	var lat1 = CurrentGeoPoint.lat.toString();
	var lng1 = CurrentGeoPoint.lng.toString();
	var lat2=$("#latitude2").val().toString();
	var lng2=$("#longitude2").val().toString();
 	window.open("http://maps.google.com/maps?f=d&saddr=" + lat1 + "," + lng1 + "&daddr=" + lat2 +","+ lng2+ "&hl=zh-TW&ie=UTF8");
}

function SearchFor(){  // 網路搜尋
	var addr=$("#title2").val();
	window.open("http://www.google.com/search?hl=zh-TW&q=" + addr );
}

function runEnd() { //結束
	var flagConfirm=confirm("確定要結束本應用程式嗎？"); //顯示確認視窗
	if(flagConfirm) { //按確定鈕
		navigator.app.exitApp();
	}
}

// 計算地球上兩點的距離
function getDistance(Lat1, Long1, Lat2, Long2){  
	 ConvertDegreeToRadians=function(degrees){
		 return (Math.PI/180)*degrees;
	 }
	 var Lat1r = ConvertDegreeToRadians(Lat1);
	 var Lat2r = ConvertDegreeToRadians(Lat2);
	 var Long1r = ConvertDegreeToRadians(Long1);
	 var Long2r = ConvertDegreeToRadians(Long2);

	 var R = 6371; // 地球半徑(km)
	 var d = Math.acos(Math.sin(Lat1r) * Math.sin(Lat2r) +
	         Math.cos(Lat1r) * Math.cos(Lat2r) * Math.cos(Long2r-Long1r)) * R;
	 return d; // 兩點的距離 (KM)
}