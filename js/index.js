// 地図表示時の中心座標
var init_center_coords = [141.347899, 43.063968];

// Bing APIのキー
var bing_api_key = 'AhGQykUKW2-u1PwVjLwQkSA_1rCTFESEC7bCZ0MBrnzVbVy7KBHsmLgwW_iRJg17';

// map
var map;

// 保育施設JSON格納用オブジェクト
var nurseryFacilities = {};

// 中心座標変更セレクトボックス用データ
var moveToList = [];

// マップサーバ一覧
var mapServerList = {
	"cyberjapn-pale": {
		label: "標準",
		source_type: "xyz",
		source: new ol.source.XYZ({
			attributions: [
				new ol.Attribution({
					html: "<a href='http://portal.cyberjapan.jp/help/termsofuse.html' target='_blank'>国土地理院</a>"
				})
			],
			url: "http://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
			projection: "EPSG:3857"
		})
	},
	'osm': {
		label: "交通",
		source_type: "osm",
		source: new ol.source.OSM({
			url: "http://{a-c}.tile.thunderforest.com/transport/{z}/{x}/{y}.png",
			attributions: [
				ol.source.OSM.DATA_ATTRIBUTION,
				new ol.Attribution({html: "Tiles courtesy of <a href='http://www.thunderforest.com/' target='_blank'>Andy Allan</a>"})
			]
		})
	},
	'bing-aerial': {
		label: "写真",
		source_type: "bing",
		source: new ol.source.BingMaps({
			culture: 'ja-jp',
			key: bing_api_key,
			imagerySet: 'Aerial',
		})
	},
	'bing-road': {
		label: "Bing",
		source_type: "bing",
		source: new ol.source.BingMaps({
			culture: 'ja-jp',
			key: bing_api_key,
			imagerySet: 'Road',
		})
	}
};

/**
 * デバイス回転時、地図の大きさを画面全体に広げる
 * @return {[type]} [description]
 */
function resizeMapDiv() {
	var screenHeight = $.mobile.getScreenHeight();
	var contentCurrentHeight = $(".ui-content").outerHeight() - $(".ui-content").height();
	var contentHeight = screenHeight - contentCurrentHeight;
	var navHeight = $("#nav1").outerHeight();
	$(".ui-content").height(contentHeight);
	$("#map").height(contentHeight - navHeight - 48);
}

$(window).on("orientationchange", function() {
	resizeMapDiv();
	map.setTarget('null');
	map.setTarget('map');
});


$('#mainPage').on('pageshow', function() {
	resizeMapDiv();

	// 地図レイヤー定義
	var papamamap = new Papamamap();
	papamamap.viewCenter = init_center_coords;
	papamamap.generate(mapServerList['cyberjapn-pale']);
	map = papamamap.map;

	// 保育施設の読み込みとレイヤーの追加
	papamamap.loadNurseryFacilitiesJson(function(data){
		nurseryFacilities = data;
	}).then(function(){
		papamamap.addNurseryFacilitiesLayer(nurseryFacilities);
	});

	// ポップアップ定義
	var popup = new ol.Overlay({
		element: $('#popup')
	});
	map.addOverlay(popup);

	// 背景地図一覧リストを設定する
	for(var item in mapServerList) {
		option = $('<option>').html(mapServerList[item].label).val(item);
		$('#changeBaseMap').append(option);
	}

	// 最寄駅セレクトボックスの生成
	mtl = new MoveToList();
	mtl.loadStationJson().then(function() {
		mtl.appendToMoveToListBox(moveToList);
	}, function(){
		mtl.loadStationJson().then(function() {
			mtl.appendToMoveToListBox(moveToList);
		});
	});

	// 保育施設クリック時の挙動を定義
	map.on('click', function(evt) {
		if ( $('#popup').is(':visible') ) {
			// ポップアップを消す
			$('#popup').hide();
			return;
		}

		// クリック位置の施設情報を取得
		var feature = map.forEachFeatureAtPixel(evt.pixel,
			function(feature, layer) {
				return feature;
			}
		);

		// クリックした場所に要素がなんにもない場合、クリック位置に地図の移動を行う
		if (feature === undefined) {
			coord = map.getCoordinateFromPixel(evt.pixel);
			view = map.getView();
			papamamap.animatedMove(coord[0], coord[1], false);
			view.setCenter(coord);

			if($('#cbDisplayCircle').prop('checked')) {
				radius = $('#changeCircleRadius').val();
				if(radius !== "") {
					// drawCenterCircle(papamamap, radius);
					drawCenterCircle(radius);
				}
			}
		}

		// クリックした場所に既に描いた同心円がある場合、円を消す
		if (feature && feature.getGeometry().getType() === "Circle") {
			$('#cbDisplayCircle').attr('checked', false).checkboxradio('refresh');
			papamamap.clearCenterCircle();
		}

		// クリックした場所に保育施設がある場合、ポップアップダイアログを出力する
		if (feature && "Point" == feature.getGeometry().getType()) {
			if(feature.get('種別') === undefined) {
				return;
			}
			var geometry = feature.getGeometry();
			var coord = geometry.getCoordinates();
			popup.setPosition(coord);

			// タイトル部
			var title = papamamap.getPopupTitle(feature);
			$("#popup-title").html(title);

			// 内容部
			papamamap.animatedMove(coord[0], coord[1], false);
			var content = papamamap.getPopupContent(feature);
			$("#popup-content").html(content);
			$('#popup').show();
		}
	});

	// 中心座標変更セレクトボックス操作イベント定義
	$('#moveTo').change(function(){
		$('#markerTitle').hide();
		$('#marker').hide();

		// 指定した最寄り駅に移動
		papamamap.moveToSelectItem(moveToList[$(this).val()]);

		// 地図上にマーカーを設定する
		var lon = moveToList[$(this).val()].lon;
		var lat = moveToList[$(this).val()].lat;
		var label = moveToList[$(this).val()].name;
		var pos = ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
		// Vienna marker
		var marker = new ol.Overlay({
			position: pos,
			positioning: 'center-center',
			element: $('#marker'),
			stopEvent: false
		});
		map.addOverlay(marker);

		// 地図マーカーラベル設定
		$('#markerTitle').html(label);
		var markerTitle = new ol.Overlay({
			position: pos,
			element: $('#markerTitle')
		});
		map.addOverlay(markerTitle);
		$('#markerTitle').show();
		$('#marker').show();
	});

	// 幼稚園チェックボックスのイベント設定
	$('#cbKindergarten').click(function() {
		papamamap.switchLayer(this.id, $(this).prop('checked'));
	});

	// 認可保育所チェックボックスのイベント設定
	$('#cbNinka').click(function() {
		papamamap.switchLayer(this.id, $(this).prop('checked'));
	});

	// 認可外保育所チェックボックスのイベント設定
	$('#cbNinkagai').click(function() {
		papamamap.switchLayer(this.id, $(this).prop('checked'));
	});

	// 中学校区チェックボックスのイベント定義
	$('#cbMiddleSchool').click(function() {
		layer = map.getLayers().item(1);
		layer.setVisible($(this).prop('checked'));
	});

	// 小学校区チェックボックスのイベント定義
	$('#cbElementarySchool').click(function() {
		layer = map.getLayers().item(2);
		layer.setVisible($(this).prop('checked'));
	});

	// 現在地に移動するボタンのイベント定義
	$('#moveCurrentLocation').click(function(evt){
		control = new MoveCurrentLocationControl();
		control.getCurrentPosition(
			function(pos) {
				var coordinate = ol.proj.transform(
					[pos.coords.longitude, pos.coords.latitude], 'EPSG:4326', 'EPSG:3857');
				view = map.getView();
				view.setCenter(coordinate);
			},
			function(err) {
				alert('位置情報が取得できませんでした。');
			}
		);
	});

	// 半径セレクトボックスのイベント定義
	$('#changeCircleRadius').change(function(evt){
		radius = $(this).val();
		if($('#cbDisplayCircle').prop('checked')) {
			// drawCenterCircle(papamamap, radius);
			drawCenterCircle(radius);
		}
	});

	// 円表示ボタンのイベント定義
	$('#cbDisplayCircle').click(function(evt) {
		radius = $('#changeCircleRadius').val();
		if($('#cbDisplayCircle').prop('checked')) {
			// drawCenterCircle(papamamap, radius);
			drawCenterCircle(radius);
		} else {
			papamamap.clearCenterCircle();
		}
	});

	// 地図変更選択ボックス操作時のイベント
	$('#changeBaseMap').change(function(evt) {
		if($(this).val() === "地図種類") {
			return;
		}
		papamamap.changeMapServer(
			mapServerList[$(this).val()], $('#changeOpacity option:selected').val()
			);
	});

	// ポップアップを閉じるイベント
	$('#popup-closer').click(function(evt){
		$('#popup').hide();
		return;
	});

	// ポップアップを閉じる
	$('.ol-popup').parent('div').click(function(evt){
		$('#popup').hide();
		return;
	});

	// 親要素へのイベント伝播を停止する
	$('.ol-popup').click(function(evt){
		evt.stopPropagation();
	});

	// 検索フィルターを有効にする
	$('#filterApply').click(function(evt){
		// 条件作成処理
		conditions = [];
		ninka = ninkagai = kindergarten = false;
		if($('#ninkaOpenTime option:selected').val() !== "") {
			conditions['ninkaOpenTime'] = $('#ninkaOpenTime option:selected').val();
			ninka = true;
		}
		if($('#ninkaCloseTime option:selected').val() !== "") {
			conditions['ninkaCloseTime'] = $('#ninkaCloseTime option:selected').val();
			ninka = true;
		}
		if($('#ninkaIchijiHoiku').prop('checked')) {
			conditions['ninkaIchijiHoiku'] = 1;
			ninka = true;
		}
		if($('#ninkaYakan').prop('checked')) {
			conditions['ninkaYakan'] = 1;
			ninka = true;
		}
		if($('#ninkaKyujitu').prop('checked')) {
			conditions['ninkaKyujitu'] = 1;
			ninka = true;
		}
		if($('#ninkaVacancy').prop('checked')) {
			conditions['ninkaVacancy'] = 1;
			ninka = true;
		}
		if($('#ninkagaiOpenTime option:selected').val() !== "") {
			conditions['ninkagaiOpenTime'] = $('#ninkagaiOpenTime option:selected').val();
			ninkagai = true;
		}
		if($('#ninkagaiCloseTime option:selected').val() !== "") {
			conditions['ninkagaiCloseTime'] = $('#ninkagaiCloseTime option:selected').val();
			ninkagai = true;
		}
		if($('#ninkagai24H').prop('checked')) {
			conditions['ninkagai24H'] = 1;
			ninkagai = true;
		}
		if($('#ninkagaiShomei').prop('checked')) {
			conditions['ninkagaiShomei'] = 1;
			ninkagai = true;
		}

		// フィルター適用時
		if(Object.keys(conditions).length > 0) {
			filter = new FacilityFilter();
			newGeoJson = filter.getFilteredFeaturesGeoJson(conditions, nurseryFacilities);
			papamamap.addNurseryFacilitiesLayer(newGeoJson);
			$('#btnFilter').css('background-color', '#3388cc');
			// console.log("filterApply total:", newGeoJson.features.length);
		} else {
			papamamap.addNurseryFacilitiesLayer(nurseryFacilities);
			$('#btnFilter').css('background-color', '#f6f6f6');
			ninka = ninkagai = youchien = true;
		}

		// レイヤー表示状態によって施設の表示を切り替える
		updateLayerStatus({ninka: ninka, ninkagai: ninkagai, kindergarten: kindergarten});
		// papamamap.switchLayer($('#cbNinka').prop('id'), ninka);
		// papamamap.switchLayer($('#cbNinkagai').prop('id'), ninkagai);
		// papamamap.switchLayer($('#cbKindergarten').prop('id'), youchien);
		// $('#cbNinka').prop('checked', ninka).checkboxradio('refresh');
		// $('#cbNinkagai').prop('checked', ninkagai).checkboxradio('refresh');
		// $('#cbKindergarten').prop('checked', youchien).checkboxradio('refresh');
	});

	// 絞込条件のリセット
	$('#filterReset').click(function(evt){
		// チェックボックスをリセット
		$(".filtercb").each(function(){
			$(this).prop('checked', false).checkboxradio('refresh');
		});
		// セレクトボックスをリセット
		$('.filtersb').each(function(){
			$(this).selectmenu(); // これを実行しないと次の行でエラー発生
			$(this).val('').selectmenu('refresh');
		});
		// 施設情報をリセット
		papamamap.addNurseryFacilitiesLayer(nurseryFacilities);
		$('#btnFilter').css('background-color', '#f6f6f6');

		updateLayerStatus({ninka: true, ninkagai: true, kindergarten: true});
	});

	/**
	 *
	 *
	 * @param  {[type]} checkObj [description]
	 * @return {[type]}               [description]
	 */
	function updateLayerStatus(checkObj)
	{
		papamamap.switchLayer($('#cbNinka').prop('id'), checkObj.ninka);
		papamamap.switchLayer($('#cbNinkagai').prop('id'), checkObj.ninkagai);
		papamamap.switchLayer($('#cbKindergarten').prop('id'), checkObj.kindergarten);
		$('#cbNinka').prop('checked', checkObj.ninka).checkboxradio('refresh');
		$('#cbNinkagai').prop('checked', checkObj.ninkagai).checkboxradio('refresh');
		$('#cbKindergarten').prop('checked', checkObj.kindergarten).checkboxradio('refresh');
	}

	/**
	 * 円を描画する 関数内関数
	 *
	 * @param  {[type]} radius    [description]
	 * @return {[type]}           [description]
	 */
	function drawCenterCircle(radius)
	{
		if($('#cbDisplayCircle').prop('checked')) {
			if ( $('#popup').is(':visible') ) {
				papamamap.drawCenterCircle(radius, papamamap.centerLatOffsetPixel);
			} else {
				papamamap.drawCenterCircle(radius);
			}
		}
	}

});
