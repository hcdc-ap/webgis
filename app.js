        // ============================================================
        // BẢO MẬT: Không còn lưu trực tiếp Supabase URL/Key thật ở đây.
        // Toàn bộ request (REST/Auth/Realtime/Functions) sẽ được gửi tới
        // CHÍNH Local Server (server.js) đang serve trang này, sau đó
        // Server mới gắn API Key thật (đọc từ .env) rồi chuyển tiếp lên
        // Supabase Cloud. Xem chi tiết tại server.js.
        // ============================================================
        // Localhost: đi qua server.js (giữ khóa thật ở .env). GitHub Pages / host tĩnh: gọi thẳng Supabase
        // bằng publishable key (khóa công khai, an toàn khi RLS đúng).
        const IS_LOCAL_HOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const SUPABASE_URL = IS_LOCAL_HOST ? window.location.origin : 'https://yjtbvlydphuvuebsyavh.supabase.co';
        const SUPABASE_KEY = IS_LOCAL_HOST ? 'local-proxy-key' : 'sb_publishable_8LF17KEVZ3XqMyAnyA6S-Q_hCGqhA5v';
        const supabaseClient = supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );
        // Đăng ký Service Worker để biến Web thành App
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker
              .register('sw.js')
              .then((reg) => console.log('PWA đã sẵn sàng!'))
              .catch((err) => console.log('Lỗi PWA:', err));
          });
        }
        // --- 1. KHAI BÁO BIẾN TOÀN CỤC ---
        let allData = [];
        let allUnits = [];
        let currentReportTags = {}; // Phải khai báo ở đây để dùng chung cho cả 2 hàm
        let filteredData = [];
        let statsData = []; // Dữ liệu dùng riêng cho Thống kê
        let markerLookup = {};
        let analyticsCharts = {};
        let hcmGeoJSON;
        let boundaryLayer = L.layerGroup(); // Lớp ranh giới TPHCM
        let idwLayer;
        let riskData = []; // Biến toàn cục chứa dữ liệu nguồn nguy cơ
        let idwDebounceTimer;
        let animationTimer = null;
        let currentDateIndex = 0;
        let currentOptimalData = []; // Biến lưu trữ kết quả tối ưu mới nhất
        let dateList = [];
        let isAnimating = false;

        let hexLayer; // Biến toàn cục quản lý lớp lưới lục giác
        // Thêm 2 biến cache ở ngoài hàm để tránh tải lại danh mục liên tục
        let cacheUnits = null;
        let cacheThresholds = null;
        let tempValidData = []; // Lưu trữ dữ liệu sạch chờ xác nhận nạp
        // Khai báo Layer Group toàn cục
        let riskLayer = L.layerGroup();
        let THRESHOLDS = {};
        const VALID_LOAI_MAU = [
          'NTM',
          'NMQB-VT',
          'TCN > 1000 m3',
          'NGHD',
          'NMN',
          'TCN < 1000 m3',
          'NNON',
          'NTH',
          'NCC, ON',
          'NMQKC',
          'NCC, HD',
          'NCC',
        ];
        const WATER_PARAMS = [
          // ================= VI SINH =================
          { name: 'Coliform tổng số', key: 'coli_tong' },
          { name: 'E.Coli hoặc Coliform chịu nhiệt', key: 'ecoli' },
          { name: 'Trực khuẩn mủ xanh', key: 'ps_aeruginosa' },
          { name: 'Tụ cầu vàng', key: 'staphylococcus_aureus' },

          // ================= CẢM QUAN - VẬT LÝ =================
          { name: 'Màu sắc', key: 'mau' },
          { name: 'Mùi vị', key: 'muivi' },
          { name: 'Độ pH', key: 'ph' },
          { name: 'Độ đục', key: 'do_duc' },
          { name: 'Clo dư', key: 'clo_du' },
          { name: 'Chỉ số Pecmanganat', key: 'pec' },

          // ================= HÓA HỌC VÔ CƠ =================
          { name: 'Amoni', key: 'amoni' },
          { name: 'Arsenic (As)', key: 'asen' },
          { name: 'Antimon', key: 'antimon' },
          { name: 'Bari', key: 'bari' },
          { name: 'Bor', key: 'bo' },
          { name: 'Cadimi', key: 'cadimi' },
          { name: 'Chì (Pb)', key: 'pb' },
          { name: 'Chloride', key: 'clorua' },
          { name: 'Chromi', key: 'chrom' },
          { name: 'Đồng (Cu)', key: 'cu' },
          { name: 'Độ cứng (CaCO3)', key: 'docung_caco3' },
          { name: 'Florua', key: 'florua' },
          { name: 'Kẽm (Zn)', key: 'zn' },
          { name: 'Mangan', key: 'mangan' },
          { name: 'Natri', key: 'natri' },
          { name: 'Nhôm', key: 'nhom' },
          { name: 'Niken', key: 'niken' },
          { name: 'Nitrat', key: 'nitrat' },
          { name: 'Nitrit', key: 'nitrit' },
          { name: 'Sắt (Fe)', key: 'fe' },
          { name: 'Selen', key: 'selen' },
          { name: 'Sunphat', key: 'sunphat' },
          { name: 'Sunfua', key: 'sunfua' },
          { name: 'Thủy ngân', key: 'thuy_ngan' },
          { name: 'Tổng chất rắn hòa tan (TDS)', key: 'tds' },
          { name: 'Xyanua', key: 'xyanua' },

          // ================= HÓA CHẤT HỮU CƠ BAY HƠI =================
          { name: '1,1,1-Tricloroetan', key: '1_1_1_tricloroetan' },
          { name: '1,2-Dicloroetan', key: '1_2_dicloroetan' },
          { name: '1,2-Dicloroeten', key: '1_2_dicloroeten' },
          { name: 'Cacbontetraclorua', key: 'cacbontetraclorua' },
          { name: 'Diclorometan', key: 'diclorometan' },
          { name: 'Tetracloroeten', key: 'tetracloroeten' },
          { name: 'Tricloroeten', key: 'tricloroeten' },
          { name: 'Vinyl clorua', key: 'vinyl_clorua' },

          // ================= HỢP CHẤT THƠM =================
          { name: 'Benzen', key: 'benzen' },
          { name: 'Etylbenzen', key: 'etylbenzen' },
          { name: 'Styren', key: 'styren' },
          { name: 'Toluen', key: 'toluen' },
          { name: 'Xylen', key: 'xylen' },

          // ================= PHENOL & DẪN XUẤT =================
          { name: 'Pentachlorophenol', key: 'pentachlorophenol' },

          // ================= CLOROBENZEN =================
          { name: '1,2-Diclorobenzen', key: '1_2_diclorobenzen' },
          { name: 'Monoclorobenzen', key: 'monoclorobenzen' },
          { name: 'Triclorobenzen', key: 'triclorobenzen' },

          // ================= CHẤT ĐỘC KHÁC =================
          { name: 'Acrylamide', key: 'acrylamide' },
          { name: 'Epiclohydrin', key: 'epiclohydrin' },
          { name: 'Hexacloro butadien', key: 'hexacloro_butadien' },
          {
            name: '1,2-Dibromo-3-cloropropan',
            key: '1_2_dibromo_3_cloropropan',
          },
          { name: '1,2-Dicloropropan', key: '1_2_dicloropropan' },
          { name: '1,3-Dichloropropen', key: '1_3_dichloropropen' },

          // ================= THUỐC BVTV =================
          { name: '2,4-D', key: '2_4_d' },
          { name: '2,4-DB', key: '2_4_db' },
          { name: 'Alachlor', key: 'alachlor' },
          { name: 'Aldicarb', key: 'aldicarb' },
          { name: 'Atrazine', key: 'atrazine' },
          { name: 'Carbofuran', key: 'carbofuran' },
          { name: 'Chlorpyrifos', key: 'chlorpyrifos' },
          { name: 'Clodane', key: 'clodane' },
          { name: 'Clorotoluron', key: 'clorotoluron' },
          { name: 'Cyanazine', key: 'cyanazine' },
          { name: 'DDT', key: 'ddt' },
          { name: 'Dichloprop', key: 'dichloprop' },
          { name: 'Fenoprop', key: 'fenoprop' },
          { name: 'Hydroxyatrazine', key: 'hydroxyatrazine' },
          { name: 'Isoproturon', key: 'isoproturon' },
          { name: 'MCPA', key: 'mcpa' },
          { name: 'Mecoprop', key: 'mecoprop' },
          { name: 'Methoxychlor', key: 'methoxychlor' },
          { name: 'Molinate', key: 'molinate' },
          { name: 'Pendimetalin', key: 'pendimetalin' },
          { name: 'Permethrin', key: 'permethrin' },
          { name: 'Propanil', key: 'propanil' },
          { name: 'Simazine', key: 'simazine' },
          { name: 'Trifuralin', key: 'trifuralin' },

          // ================= PHỤ PHẨM KHỬ TRÙNG =================
          { name: 'Bromat', key: 'bromat' },
          { name: 'Formaldehyde', key: 'formaldehyde' },
          { name: 'Monochloramine', key: 'monochloramine' },
          { name: 'Bromodichloromethane', key: 'bromodichloromethane' },
          { name: 'Bromoform', key: 'bromoform' },
          { name: 'Chloroform', key: 'chloroform' },
          { name: 'Dibromochloromethane', key: 'dibromochloromethane' },
          { name: 'Dibromoacetonitrile', key: 'dibromoacetonitrile' },
          { name: 'Dichloroacetonitrile', key: 'dichloroacetonitrlle' },
          { name: 'Trichloroacetonitrile', key: 'trichloroaxetonitril' },
          { name: 'Monochloroacetic acid', key: 'monochloroacetic_acid' },
          { name: 'Dichloroacetic acid', key: 'dichloroacetic_acid' },
          { name: 'Trichloroacetic acid', key: 'trichloroacetic_acid' },

          // ================= PHÓNG XẠ =================
          {
            name: 'Tổng hoạt độ phóng xạ Anpha',
            key: 'tong_hoat_do_phong_xa_anpha',
          },
          {
            name: 'Tổng hoạt độ phóng xạ Beta',
            key: 'tong_hoat_do_phong_xa_beta',
          },
        ];
        // Ngưỡng giới hạn (Ví dụ một số thông số chính, bạn có thể điền tiếp)
        const LIMITS = {
          ph: {
            min: 6.0,
            max: 8.5,
          },
          clo_du: {
            min: 0.2,
            max: 1.0,
          },
          do_duc: {
            max: 2.0,
          },
          coli_tong: {
            max: 0,
          },
          ecoli: {
            max: 0,
          },
          // Thêm các thông số khác vào đây...
        };
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end', // Hiện ở góc trên bên phải
          showConfirmButton: false,
          timer: 3000, // Tự đóng sau 3 giây
          timerProgressBar: true, // Thanh tiến trình chạy ở dưới
          showClass: {
            popup: 'animate__animated animate__fadeInRight', // Hiệu ứng bay vào từ bên phải
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOutRight', // Hiệu ứng bay ra
          },
          didOpen: (toast) => {
            // Dừng đếm ngược khi di chuột vào, chạy tiếp khi di chuột ra
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
          },
        });
        // Bounding box xấp xỉ của TP.HCM mới (bao gồm cả Cần Giờ và các huyện giáp ranh)
        const HCM_BOUNDS = {
          latMin: 10.3,
          latMax: 11.2,
          lngMin: 106.3,
          lngMax: 107.1,
        };
        // Định nghĩa màu sắc/icon cho từng loại
        const riskStyles = {
          hospital: {
            color: '#008b99',
            icon: 'fa-hospital',
          }, // Đỏ - Y tế
          clinic: {
            color: '#008b99',
            icon: 'fa-stethoscope',
          },
          cemetery: {
            color: '#7f8c8d',
            icon: 'fa-monument',
          }, // Xám - Nghĩa trang
          landfill: {
            color: '#f39c12',
            icon: 'fa-trash-alt',
          }, // Cam - Rác thải
          slaughterhouse: {
            color: '#f26522',
            icon: 'fa-khanda',
          }, // Tím - Giết mổ
          school: {
            color: 'var(--success)',
            icon: 'fa-graduation-cap',
          }, // Xanh dương - Trường học
          default: {
            color: '#2c3e50',
            icon: 'fa-exclamation-triangle',
          },
        };
        // --- 2. CẤU HÌNH BẢN ĐỒ NỀN (BASEMAPS) ---
        // 2.1. Định nghĩa các loại bản đồ nền
        const streetMap = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution: '© OpenStreetMap',
          }
        );
        const satelliteMap = L.tileLayer(
          'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          {
            attribution: '© Google Satellite',
          }
        );
        const hybridMap = L.tileLayer(
          'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          {
            attribution: '© Google Hybrid',
          }
        );
        // 2.2. Khởi tạo bản đồ với lớp Street mặc định
        const map = L.map('map', {
          preferCanvas: true,
          center: [10.7626, 106.6602],
          zoom: 11,
          layers: [streetMap], // Lớp hiện lên đầu tiên
        });
        // --- 3. CÁC LỚP DỮ LIỆU CHUYÊN MÔN (OVERLAYS) ---
        const markers = L.markerClusterGroup();
        const monitoringPointsLayer = L.layerGroup();
        const heatmapLayer = L.heatLayer([], {
          radius: 25,
          blur: 15,
          max: 1.0,
        });
        // --- 4. BỔ SUNG TÍNH NĂNG NÂNG CAO (GEOCODER & PRINT) ---
        idwLayer = L.geoJson(null);
        // 4.1. Bộ tìm kiếm địa chỉ (Geocoder)
        const geocoder = L.Control.geocoder({
          defaultMarkGeocode: false,
          placeholder: 'Tìm địa chỉ/vị trí...',
        })
          .on('markgeocode', function (e) {
            const bbox = e.geocode.bbox;
            // Bước 1: Tạm thời tắt IDW nếu nó đang bật để tránh đơ
            const isIDWActive = map.hasLayer(idwLayer);
            if (isIDWActive) map.removeLayer(idwLayer);
            // Bước 2: Di chuyển bản đồ không hiệu ứng
            map.fitBounds(bbox, {
              animate: false,
            });
            // Bước 3: Thêm marker điểm tìm được
            L.marker(e.geocode.center)
              .addTo(map)
              .bindPopup(e.geocode.name)
              .openPopup();
            // Bước 4: Sau khi xong xuôi 500ms mới bật lại IDW (nếu trước đó đang bật)
            if (isIDWActive) {
              setTimeout(() => {
                map.addLayer(idwLayer);
                updateIDW(document.getElementById('idw-selector').value);
              }, 500);
            }
          })
          .addTo(map);
        // 4.2. Nút In bản đồ (Print)
        L.control
          .browserPrint({
            title: 'In bản đồ giám sát',
            documentTitle: 'Báo cáo giám sát chất lượng nước HCDC',
            printLayer: streetMap, // Sử dụng StreetMap làm nền in mặc định
            closePopupsOnPrint: false,
          })
          .addTo(map);
        // --- 5. QUẢN LÝ LỚP (LAYER CONTROL) ---
        const baseMaps = {
          "<i class='fas fa-map'></i> OpenStreetMap": streetMap,
          "<i class='fas fa-satellite'></i> Google Maps": satelliteMap,
          "<i class='fas fa-globe-asia'></i> Satellite": hybridMap,
        };
        const overlayMaps = {
          "<i class='fas fa-layer-group'></i> Points": monitoringPointsLayer,
          "<i class='fas fa-layer-group'></i> Clusters": markers,
          "<i class='fas fa-fire'></i> Heatmap": heatmapLayer,
          "<i class='fas fa-braille'></i> IDW": idwLayer,
          "<i class='fas fa-draw-polygon'></i> HCM City": boundaryLayer,
          "<i class='fas fa-draw-suqare'></i> Vị trí nguy cơ": riskLayer,
        };
        // Đưa tất cả vào bộ điều khiển Layer
        L.control
          .layers(baseMaps, overlayMaps, {
            collapsed: true,
            position: 'topright',
          })
          .addTo(map);

        function createBufferZone(lat, lng, radiusKm = 0.5) {
          bufferLayer.clearLayers();
          const center = [lng, lat]; // Turf dùng [lng, lat]
          const buffer = turf.buffer(turf.point(center), radiusKm, {
            units: 'kilometers',
          });
          // Vẽ vùng đệm lên bản đồ
          L.geoJson(buffer, {
            style: {
              color: '#f26522',
              weight: 2,
              fillColor: '#f26522',
              fillOpacity: 0.2,
              dashArray: '5, 5',
            },
          }).addTo(bufferLayer);
          // Tìm các trạm khác nằm trong vùng nguy cơ này
          const pointsInside = statsData.filter((d) => {
            const pt = turf.point([parseFloat(d.lng), parseFloat(d.lat)]);
            return turf.booleanPointInPolygon(pt, buffer);
          });
          console.log(
            `Có ${pointsInside.length} trạm nằm trong vùng ảnh hưởng.`
          );
        }
        // --- 6. TẠO BẢNG CHÚ GIẢI (LEGEND) Ở GÓC TRÁI ---
        const legend = L.control({
          position: 'bottomleft',
        }); // Đổi sang góc dưới bên trái
        legend.onAdd = function (map) {
          const div = L.DomUtil.create('div', 'info legend');
          div.innerHTML = updateLegendContent(false);
          return div;
        };
        legend.addTo(map);
        // Hàm tạo nội dung (giữ nguyên logic thông minh của chúng ta)
        function updateLegendContent(isHeatmapActive) {
          let html = `
          <h4 style="margin-bottom:10px; border-bottom:1px solid #34495e; padding-bottom:5px;">Legend</h4>
          <div class="legend-item"><i style="background: #008b99;"></i> <span>Mẫu đạt</span></div>
          <div class="legend-item"><i style="background: #f26522;"></i> <span>Mẫu Không đạt</span></div>
          <div class="legend-item"><span class="legend-line" style="background: #34495e;"></span> <span>Ranh giới hành chính</span></div>
        `;

          // --- THÊM CHÚ GIẢI HEATMAP ---
          if (isHeatmapActive) {
            html += `
      <div class="legend-item" style="margin-top:10px; border-top:1px solid #ddd; padding-top:5px;">
        <small><b>MẬT ĐỘ KHÔNG ĐẠT (HEATMAP)</b></small><br>
        <div style="background: linear-gradient(to right, blue, lime, yellow, red); height:10px; width:100%; border-radius:3px; margin-top:5px;"></div>
        <div style="display:flex; justify-content: space-between; font-size:10px;">
          <span>Thấp</span><span>Cao</span>
        </div>
      </div>
    `;
          }

          return html;
        }
        // --- 7. LẮNG NGHE SỰ KIỆN (BẮT BUỘC ĐỂ CẬP NHẬT LEGEND) ---
        map.on('overlayadd', function (e) {
          if (e.name.includes('Heatmap')) {
            const div = document.querySelector('.info.legend');

            if (div) div.innerHTML = updateLegendContent(true);
          }
          if (e.name.includes('Hexagonal Risk Grid')) {
            const div = document.querySelector('.info.legend');

            if (div) div.innerHTML = updateLegendContent(true);
          }
          if (e.name.includes('IDW')) {
            // Hiển thị thông báo đang xử lý nếu muốn
            console.log('Đang tính toán IDW...');
            setTimeout(() => {
              const param = document.getElementById('idw-selector').value;
              updateIDW(param);
            }, 100); // Cho trình duyệt 100ms để "thở" và cập nhật giao diện nút bấm trước khi tính toán
          }
        });
        map.on('overlayremove', function (eventLayer) {
          if (eventLayer.name.includes('Heatmap')) {
            const div = document.querySelector('.info.legend');
            if (div) div.innerHTML = updateLegendContent(false);
          }
          if (eventLayer.name.includes('Hexagonal Risk Grid')) {
            const div = document.querySelector('.info.legend');
            if (div) div.innerHTML = updateLegendContent(false);
          }
        });
        // Thêm các lớp mặc định muốn hiện ngay từ đầu
        map.addLayer(markers);
        map.addLayer(boundaryLayer);

        function getIDWColor(val, param) {
          if (val === null || val === undefined) return '#dcdde1'; // Màu xám cho dữ liệu trống
          switch (param) {
            case 'ph':
              // Ngưỡng: 6.0 - 8.5
              return val < 6.0 || val > 8.5 ? '#f26522' : '#008b99';
            case 'clo_du':
              // Ngưỡng: 0.2 - 1.0 (Dưới 0.2: Đỏ, Trên 1.0: Cam cảnh báo)
              return val < 0.2 ? '#f26522' : val > 1.0 ? '#f39c12' : '#008b99';
            case 'mau':
              // Ngưỡng: <= 15 TCU
              return val > 15 ? '#f26522' : '#008b99';
            case 'do_duc':
              // Ngưỡng: <= 2 NTU
              return val > 2.0 ? '#f26522' : '#008b99';
            case 'fe':
              // Ngưỡng: <= 0.3 mg/L
              return val > 0.3 ? '#f26522' : '#008b99';
            case 'mangan':
              // Ngưỡng: <= 0.1 mg/L
              return val > 0.1 ? '#f26522' : '#008b99';
            case 'pec':
              // Chỉ số Pecmanganat - Ngưỡng: <= 2 mg/L
              return val > 2.0 ? '#f26522' : '#008b99';
            case 'asen':
              // Ngưỡng: <= 0.01 mg/L
              return val > 0.01 ? '#f26522' : '#008b99';
            // Nhóm vi sinh vật: Chỉ cần > 0 là không đạt (Màu Đỏ)
            case 'coli_tong':
            case 'ecoli':
            case 'ps_aeruginosa':
            case 'staphylococcus_aureus':
              return val > 0 ? '#f26522' : '#008b99';
            default:
              // Nếu là các thông số khác hoặc chưa định nghĩa, mặc định màu xanh dương nhẹ
              return 'var(--success)';
          }
        }

        function updateIDW(parameter) {
          console.group('🚀 Update IDW Clipped - HCM (maTinh=701)');
          // Thêm ngay đầu hàm updateIDW
          const PARAMETER_NAMES = {
            clo_du: 'Clo dư',
            ph: 'Độ pH',
            do_duc: 'Độ đục',
            mau: 'Màu',
            fe: 'Sắt',
            mangan: 'Mangan',
            pec: 'Chỉ số pecmanganat',
            asen: 'Asen',
            coli_tong: 'Coli',
            ecoli: 'E.Coli',
            ps_aeruginosa: 'Trực khuẩn mủ xanh',
            staphylococcus_aureus: 'Tụ cầu vàng',
          };
          // 1. KIỂM TRA ĐIỀU KIỆN CƠ BẢN
          if (!window.hcmGeoJSON) {
            console.error(
              '❌ Chưa load HCM Boundary. Hãy chạy loadHCMBoundary() trước.'
            );
            idwLayer.clearLayers();
            console.groupEnd();
            return;
          }
          if (typeof turf === 'undefined') {
            console.error('❌ Turf.js chưa load. Cần phiên bản >=6.5.0');
            console.groupEnd();
            return;
          }
          try {
            // 2. 🔍 LỌC CHÍNH XÁC RANH GIỚI HCM TỪ GEOJSON
            let hcmFeatures = [];
            // Xử lý cả FeatureCollection và Feature đơn
            if (window.hcmGeoJSON.type === 'FeatureCollection') {
              hcmFeatures = window.hcmGeoJSON.features.filter((f) => {
                const props = f.properties || {};
                const ma = props.maTinh; // Giữ nguyên kiểu số (701)
                const ten = String(props.tenTinh || '')
                  .toLowerCase()
                  .trim();
                return (
                  ma === 701 || // So sánh trực tiếp với số 701
                  ten.includes('hồ chí minh') ||
                  ten.includes('hcm') ||
                  ten.includes('sài gòn')
                );
              });
            } else if (window.hcmGeoJSON.type === 'Feature') {
              const props = window.hcmGeoJSON.properties || {};
              const ma = props.maTinh;
              const ten = String(props.tenTinh || '')
                .toLowerCase()
                .trim();
              if (ma === 701 || ten.includes('hồ chí minh')) {
                hcmFeatures = [window.hcmGeoJSON];
              }
            }
            console.log(
              `🔍 Tìm thấy ${hcmFeatures.length} features thuộc HCM (maTinh=701)`
            );
            // 3. 🧩 GỘP RANH GIỚI THÀNH 1 ĐA GIÁC DUY NHẤT (SỬA LỖI MultiPolygon)
            let hcmPoly = null;
            if (hcmFeatures.length > 0) {
              try {
                // BƯỚC 1: CHUYỂN TẤT CẢ MultiPolygon → Polygon
                const fc = turf.featureCollection(hcmFeatures);
                const flattened = turf.flatten(fc); // ✅ CHÌA KHÓA GIẢI QUYẾT LỖI
                // BƯỚC 2: DÙNG dissolve TRÊN Polygon ĐÃ FLATTEN
                const dissolved = turf.dissolve(flattened, {
                  propertyName: 'maTinh',
                });
                if (dissolved.features.length > 0) {
                  hcmPoly = dissolved.features[0];
                  console.log(
                    '✅ Ranh giới HCM đã được flatten + dissolve thành công!'
                  );
                  // BƯỚC 3: CHUYỂN MultiPolygon (nếu có) → Polygon DUY NHẤT
                  if (hcmPoly.geometry.type === 'MultiPolygon') {
                    console.warn(
                      '⚠️ Ranh giới vẫn là MultiPolygon, dùng first polygon'
                    );
                    hcmPoly.geometry = {
                      type: 'Polygon',
                      coordinates: hcmPoly.geometry.coordinates[0],
                    };
                  }
                }
              } catch (e) {
                console.error('❌ Lỗi sau khi flatten:', e);
                hcmPoly = hcmFeatures[0]; // Fallback: dùng feature đầu tiên
              }
            }
            // 4. 📏 XÁC ĐỊNH BOUNDING BOX AN TOÀN
            let bbox = [106.3, 10.3, 107.1, 11.1]; // BBox mặc định TPHCM
            if (hcmPoly) {
              try {
                bbox = turf.bbox(hcmPoly);
                console.log('🗺️ BBox thực tế:', bbox);
              } catch (e) {
                console.warn('⚠️ Lỗi tính bbox, dùng BBox mặc định');
              }
            }
            // 5. 📊 XỬ LÝ ĐIỂM DỮ LIỆU
            const validPoints = statsData.filter((p) => {
              const val = parseFloat(p[parameter]);
              return (
                !isNaN(p.lng) && !isNaN(p.lat) && !isNaN(val) && val >= 0 // Loại bỏ giá trị âm (nếu có)
              );
            });
            if (validPoints.length < 3) {
              console.warn(
                `⚠️ Chỉ có ${validPoints.length} điểm dữ liệu hợp lệ (cần >=3)`
              );
              idwLayer.clearLayers();
              console.groupEnd();
              return;
            }
            const pointsFC = turf.featureCollection(
              validPoints.map((p) =>
                turf.point([+p.lng, +p.lat], {
                  val: +p[parameter],
                })
              )
            );
            // 6. 🌐 TẠO GRID + NỘI SUY IDW + CLIP AN TOÀN
            const grid = turf.squareGrid(bbox, 0.63, {
              units: 'kilometers',
            });
            const finalFeatures = [];
            grid.features.forEach((cell) => {
              const center = turf.centerOfMass(cell);
              let sumW = 0,
                sumV = 0;
              // Tính trọng số IDW
              pointsFC.features.forEach((pt) => {
                const d = turf.distance(center, pt, {
                  units: 'kilometers',
                });
                if (d < 0.001) return; // Tránh chia cho 0
                const w = 1 / (d * d);
                sumW += w;
                sumV += w * pt.properties.val;
              });
              if (sumW === 0) return;
              const val = sumV / sumW;
              // ✂️ CLIP AN TOÀN (KIỂM TRA HÌNH HỌC TRƯỚC)
              if (hcmPoly) {
                try {
                  // Kiểm tra tính hợp lệ của đa giác trước khi intersect
                  if (!turf.booleanValid(hcmPoly) || !turf.booleanValid(cell)) {
                    throw new Error('Invalid geometry');
                  }
                  const clipped = turf.intersect(cell, hcmPoly);
                  if (clipped && turf.booleanValid(clipped)) {
                    clipped.properties = {
                      val,
                    };
                    finalFeatures.push(clipped);
                  }
                } catch (e) {
                  // Fallback: Dùng center check nếu intersect lỗi
                  if (turf.booleanPointInPolygon(center, hcmPoly)) {
                    cell.properties = {
                      val,
                    };
                    finalFeatures.push(cell);
                  }
                }
              } else {
                // Trường hợp không có ranh giới HCM
                cell.properties = {
                  val,
                };
                finalFeatures.push(cell);
              }
            });
            // 7. 🎨 VẼ KẾT QUẢ - CHỈ HIỂN THỊ IDW, KHÔNG VIỀN ĐỎ
            console.log(`✅ Đã tạo ${finalFeatures.length} ô màu IDW`);
            idwLayer.clearLayers();
            if (finalFeatures.length > 0) {
              L.geoJSON(turf.featureCollection(finalFeatures), {
                style: (f) => ({
                  fillColor: getIDWColor(f.properties.val, parameter),
                  fillOpacity: 0.5,
                  color: 'transparent',
                  weight: 0,
                }),
                onEachFeature: (f, layer) => {
                  // 🔑 PHỤC HỒI PHẦN DỰ BÁO THÔNG SỐ (GIỐNG NGUYÊN BẢN)
                  const displayName = PARAMETER_NAMES[parameter] || parameter;
                  layer.bindTooltip(
                    `Dự đoán ${displayName}: ${f.properties.val.toFixed(2)}`,
                    {
                      sticky: true,
                    }
                  );
                },
              }).addTo(idwLayer);
            }
          } catch (err) {
            console.error('❌ LỖI CHẾT TRONG updateIDW:', err);
            console.error('Chi tiết lỗi:', {
              message: err.message,
              stack: err.stack,
              hcmGeoJSON: window.hcmGeoJSON,
            });
            // Xóa lớp IDW khi có lỗi nghiêm trọng
            idwLayer.clearLayers();
          }
          console.groupEnd();
        }
        // Giả sử riskData là biến toàn cục chứa dữ liệu từ loadRiskLocations

        async function loadRiskLocations() {
          const { data, error } = await supabaseClient
            .from('risk_locations')
            .select('*');
          if (error) {
            console.error('Lỗi kết nối Supabase:', error.message);
            return;
          }
          // THÊM DÒNG NÀY ĐỂ KIỂM TRA
          console.log('Dữ liệu thô từ Supabase:', data);
          riskData = data || [];
          renderRiskMarkers(); // Sau đó mới gọi hàm vẽ
        }

        function findNearbyRisks(lat, lng, radiusKm) {
          const center = turf.point([lng, lat]);
          // Lọc danh sách các nguồn nguy cơ nằm trong bán kính
          const nearby = riskData.filter((loc) => {
            const riskPt = turf.point([loc.lng, loc.lat]);
            const distance = turf.distance(center, riskPt, {
              units: 'kilometers',
            });
            return distance <= radiusKm;
          });
          // Sắp xếp theo khoảng cách từ gần đến xa
          nearby.sort((a, b) => {
            const distA = turf.distance(center, turf.point([a.lng, a.lat]));
            const distB = turf.distance(center, turf.point([b.lng, b.lat]));
            return distA - distB;
          });
          return nearby;
        }

        function updateRiskPanel(lat, lng, radiusKm) {
          const panel = document.getElementById('risk-analysis-panel');
          const list = document.getElementById('risk-list');
          if (!panel || !list) return;
          // 1. Dùng allData để tìm các trạm xung quanh (vì biến này chắc chắn có dữ liệu)
          const nearbyStations = allData.filter((s) => {
            if (!s.lat || !s.lng) return false;
            const dist = turf.distance(
              turf.point([lng, lat]),
              turf.point([s.lng, s.lat]),
              {
                units: 'kilometers',
              }
            );
            // Bán kính 1km và không tính chính trạm mình đang click
            return dist > 0 && dist <= radiusKm;
          });
          // 2. Lọc nguồn nguy cơ (nếu biến riskData đã nạp từ Supabase)
          const nearbyRisks =
            typeof riskData !== 'undefined'
              ? riskData.filter((loc) => {
                  const dist = turf.distance(
                    turf.point([lng, lat]),
                    turf.point([loc.lng, loc.lat]),
                    {
                      units: 'kilometers',
                    }
                  );
                  return dist <= radiusKm;
                })
              : [];
          // 3. Vẽ lên giao diện
          list.innerHTML = '';
          panel.style.display = 'block';
          // Hiện Trạm nước (màu xanh) - Chính là 3 trạm bạn thấy ở Console
          nearbyStations.forEach((s) => {
            const d = turf.distance(
              turf.point([lng, lat]),
              turf.point([s.lng, s.lat]),
              {
                units: 'kilometers',
              }
            );
            list.innerHTML += `
      <div class="risk-item" style="border-left: 4px solid var(--success); cursor:pointer" onclick="map.flyTo([${
        s.lat
      }, ${s.lng}], 16)">
        <div class="risk-info">
          <span class="risk-name">📍 ${s.csccn_name}</span>
          <span class="risk-type">Kết quả: ${s.danh_gia_tu_dong}</span>
        </div>
        <span class="risk-distance" style="background:var(--success)">${d.toFixed(
          2
        )}km</span>
      </div>`;
          });
          // Hiện Nguồn nguy cơ (màu đỏ - nếu có)
          nearbyRisks.forEach((loc) => {
            list.innerHTML += `
      <div class="risk-item" style="border-left: 4px solid #008b99;">
        <div class="risk-info">
          <span class="risk-name">⚠️ ${loc.name}</span>
          <span class="risk-type">${loc.type}</span>
        </div>
      </div>`;
          });
          if (nearbyStations.length === 0 && nearbyRisks.length === 0) {
            list.innerHTML =
              '<div class="risk-empty">Không tìm thấy đối tượng nào trong bán kính 1km.</div>';
          }
        }
        // 2. Hàm vẽ markers lên riskLayer
        function renderRiskMarkers() {
  riskLayer.clearLayers();
  
  if (!riskData || riskData.length === 0) {
    console.warn('⚠️ Không có dữ liệu nguồn nguy cơ để hiển thị.');
    return;
  }

  riskData.forEach((loc) => {
    if (loc.lat && loc.lng) {
      const style = riskStyles[loc.type] || riskStyles['default'];
      
      // 1. Dùng L.divIcon để có thể render HTML (FontAwesome)
      const customIcon = L.divIcon({
        className: 'custom-risk-icon', // Class để sếp tinh chỉnh CSS nếu cần
        html: `
          <div style="
            background-color: ${style.color}; 
            width: 17px; 
            height: 17px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            border: 2px solid white; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            color: white;
          ">
            <i class="fa-solid ${style.icon}" style="font-size: 12px;"></i>
          </div>
        `,
        iconSize: [7, 7],
        iconAnchor: [4, 4],
        popupAnchor: [0, -4]
      });

      // 2. Sử dụng L.marker thay vì L.circleMarker
      const marker = L.marker([loc.lat, loc.lng], {
        icon: customIcon
      });

      marker.bindPopup(`
        <div style="text-align:left; min-width: 150px;">
            <strong style="color:${style.color}; font-size: 1.1em; display: block; margin-bottom: 5px;">
                <i class="fa-solid ${style.icon}"></i> ${loc.name}
            </strong>
            <b>Phân loại:</b> ${loc.type}<br>
            <hr style="margin: 8px 0">
            <button class="btn btn-sm btn-primary w-100" 
                    onclick="map.flyTo([${loc.lat}, ${loc.lng}], 17)">
                <i class="fa-solid fa-search-plus"></i> Zoom in
            </button>
        </div>
      `);

      riskLayer.addLayer(marker);
    }
  });
}
        // --- 3. CÁC HÀM XỬ LÝ DỮ LIỆU ---
        async function init() {
          try {
            console.log('🚀 Đang khởi tạo hệ thống Sentinel-AI...');
            let allFetchedData = [];
            let from = 0;
            let to = 999;
            let hasMore = true;

            // 1. Tải toàn bộ dữ liệu từ quá khứ đến hiện tại (Chiến thuật Chia để trị)
            while (hasMore) {
              const { data: batch, error } = await supabaseClient
                .from('view_report_results')
                .select('*')
                .order('sampling_date', { ascending: false })
                .range(from, to);

              if (error) throw error;

              allFetchedData = allFetchedData.concat(batch);

              if (batch.length < 1000) {
                hasMore = false; // Đã lấy hết sạch dữ liệu
              } else {
                from += 1000;
                to += 1000;
              }
            }

            // Tiền xử lý dữ liệu: Ép kiểu Date ngay từ đầu để tránh lỗi "Invalid Date"
            allData = allFetchedData
              .map((d) => ({
                ...d,
                sampling_date: d.sampling_date
                  ? new Date(d.sampling_date)
                  : null,
              }))
              .filter(
                (d) => d.sampling_date && !isNaN(d.sampling_date.getTime())
              )
              .sort((a, b) => a.sampling_date - b.sampling_date);

            console.log(`📊 Tổng kho: ${allData.length} mẫu. Năm tìm thấy:`, [
              ...new Set(allData.map((d) => d.sampling_date.getFullYear())),
            ]);
            // 📊 TẢI DANH SÁCH ĐƠN VỊ (UNITS)
            const { data: unitData, error: unitError } = await supabaseClient
              .from('units')
              .select('*');

            if (unitError) throw unitError;

            // ✅ QUAN TRỌNG: Gán vào biến toàn cục đã khai báo ở đầu file
            allUnits = unitData;

            console.log(`📡 Đã tải ${allUnits.length} đơn vị vào bộ nhớ.`);
            // 2. Khởi tạo danh sách Đơn vị (CSCCN)
            const wards = [...new Set(allData.map((d) => d.csccn_name))]
              .filter((w) => w)
              .sort();
            const wSelect = document.getElementById('f-ward');
            wSelect.innerHTML = '<option value="all">-- Tất cả --</option>';
            wards.forEach((w) => {
              const option = document.createElement('option');
              option.value = w;
              option.textContent = w;
              wSelect.appendChild(option);
            });

            // 3. Tải ranh giới & bản đồ phụ
            await loadHCMBoundary();
            await loadRiskLocations();

            // 4. Cấu hình Slider (Tầm nhìn từ 2024, Tiêu điểm 2026)
            setupSlider();

            // 5. Lọc và vẽ lần đầu
            applyFilters();

            // 6. Realtime Listener
            setupRealtime();

            // Resize logic
            window.addEventListener('resize', handleResize);
            console.log('✅ Hệ thống WebGIS HCDC đã sẵn sàng.');
          } catch (err) {
            console.error('❌ Lỗi khởi tạo:', err.message);
            showToast('error', 'Không thể kết nối cơ sở dữ liệu.');
          }
        }
        async function setupRealtime() {
          try {
            console.log('📡 Đang thiết lập kênh Realtime cho Sentinel-AI...');

            // 1. Dọn dẹp kênh cũ để tránh bị trùng lặp listener khi refresh
            await supabaseClient.removeChannel(
              supabaseClient.channel('hcdc-realtime')
            );

            // 2. Khởi tạo kênh mới lắng nghe bảng water_reports
            const channel = supabaseClient
              .channel('hcdc-realtime')
              .on(
                'postgres_changes',
                {
                  event: '*', // Lắng nghe mọi sự kiện: INSERT, UPDATE, DELETE
                  schema: 'public',
                  table: 'water_reports',
                },
                async (payload) => {
                  console.log('🔔 Có cập nhật mới từ hiện trường:', payload);

                  // Khi có dữ liệu mới, mình cần làm 2 việc:
                  // A. Thông báo cho người dùng
                  showToast(
                    'info',
                    'Hệ thống vừa nhận được dữ liệu lấy mẫu mới!'
                  );

                  // B. Tải lại dữ liệu hoặc cập nhật UI (tùy sếp muốn reload nhẹ hay nặng)
                  // Cách nhẹ nhất: Gọi lại hàm init để đồng bộ lại toàn bộ kho dữ liệu
                  // Hoặc đơn giản là thông báo sếp nhấn F5 để làm mới hoàn toàn.
                  if (typeof updateUI === 'function') {
                    updateUI();
                    // Nếu sếp đã có hàm updateUI riêng để xử lý payload thì gọi ở đây
                    // Nếu không, sếp có thể dùng: location.reload(); để "chắc cú"
                  }
                }
              )
              .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                  console.log(
                    '✅ Kênh Realtime đã thông suốt. Đang canh gác dữ liệu!'
                  );
                }
              });
          } catch (err) {
            console.error('❌ Lỗi thiết lập Realtime:', err);
          }
        }

        function applyFilters() {
          const slider = document.getElementById('time-slider');
          if (!slider || !slider.noUiSlider) return;

          const [start, end] = slider.noUiSlider.get().map((v) => parseInt(v));
          const general = document.getElementById('f-general').value;
          const ward = document.getElementById('f-ward').value;
          const checkedParams = Array.from(
            document.querySelectorAll('.f-param:checked')
          ).map((c) => c.value);

          // 1. Lọc dữ liệu theo thời gian và địa bàn
          statsData = allData.filter((d) => {
            const time = d.sampling_date.getTime();
            return (
              time >= start &&
              time <= end &&
              (ward === 'all' || d.csccn_name === ward)
            );
          });

          // 2. Lọc sâu cho Bản đồ và Bảng (Dữ liệu này sẽ đẩy vào Analytics)
          filteredData = statsData.filter((d) => {
            const mGen =
              general === 'all' ||
              (general === 'fail'
                ? d.danh_gia_tu_dong !== 'Đạt'
                : d.danh_gia_tu_dong === general);
            const mParam =
              checkedParams.length === 0 ||
              checkedParams.some((p) => d[p] === 'K');
            return mGen && mParam;
          });

          updateUI(); // Cập nhật Map, Table chính

          // 3. Cập nhật các lớp phân tích (Debounce để mượt mà)
          clearTimeout(idwDebounceTimer);
          idwDebounceTimer = setTimeout(() => {
            const param = document.getElementById('idw-selector').value;
            updateIDW(param);

            // CHỖ NÀY QUAN TRỌNG: Nếu sếp đang mở bảng phân tích, cập nhật nó luôn bằng dữ liệu vừa lọc
            if (
              document.getElementById('tables-overlay').style.display === 'flex'
            ) {
              loadAnalyticsData();
            }

            if (
              document.getElementById('analytics-overlay').style.display ===
              'flex'
            ) {
              renderCharts();
            }
          }, 300);
        }

        function updateUI() {
          // 1. Dọn dẹp các lớp dữ liệu cũ
          if (markers) markers.clearLayers(); // Lớp Cluster
          if (monitoringPointsLayer) monitoringPointsLayer.clearLayers(); // Lớp điểm đơn lẻ

          const heatPoints = [];
          const tbody = document.getElementById('table-body');
          if (tbody) tbody.innerHTML = '';

          // Cập nhật số lượng tìm thấy
          const statCountEl = document.getElementById('stat-count');
          if (statCountEl) {
            statCountEl.innerHTML = `Tìm thấy: <span class="highlight">${filteredData.length}</span> mẫu`;
          }

          filteredData.forEach((p) => {
            const isFail = p.danh_gia_tu_dong !== 'Đạt';
            const errs = geterrs(p);

            // --- BƯỚC 1: XỬ LÝ VẼ LÊN BẢN ĐỒ (CHỐNG LỖI LAT/LNG NULL) ---
            let marker = null;
            if (p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng)) {
              marker = L.circleMarker([p.lat, p.lng], {
                radius: 8,
                fillColor: isFail ? '#f26522' : '#008b99',
                color: '#fff',
                weight: 1,
                fillOpacity: 0.8,
              });

              // Gán Popup (Đã dùng formatDateDisplay chuẩn)
              marker.bindPopup(`
        <div style="min-width: 200px">
            <strong style="font-size:1.1rem">${p.csccn_name}</strong><br>
            <hr style="margin: 5px 0">
            <b>Ngày lấy mẫu:</b> ${formatDateDisplay(p.sampling_date)}<br>
            <b>Kết quả:</b> <span style="color:${
              isFail ? 'red' : 'green'
            }"><b>${p.danh_gia_tu_dong}</b></span><br>
            <b style="color:#f26522">Thông số không đạt:</b> ${
              errs.join(', ') || 'Không có'
            }
        </div>
      `);

              // Sự kiện Click trên bản đồ
              marker.on('click', (e) => {
                if (isFail) {
                  createBufferZone(
                    e.latlng.lat,
                    e.latlng.lng,
                    1.0,
                    p.csccn_name
                  );
                  updateRiskPanel(e.latlng.lat, e.latlng.lng, 1.0);
                  if (!map.hasLayer(riskLayer)) map.addLayer(riskLayer);
                } else {
                  if (window.bufferLayer) bufferLayer.clearLayers();
                  const panel = document.getElementById('risk-analysis-panel');
                  if (panel) panel.style.display = 'none';
                }
                marker.openPopup();
              });

              // Thêm vào các lớp hiển thị
              markers.addLayer(marker);
              monitoringPointsLayer.addLayer(marker);
              if (isFail) heatPoints.push([p.lat, p.lng, 0.8]);
            }

            // --- BƯỚC 2: ĐỔ DỮ LIỆU VÀO BẢNG (ĐỊNH DẠNG LẠI NGÀY) ---
            if (tbody) {
              const row = document.createElement('tr');
              row.innerHTML = `
        <td style="white-space:nowrap">${formatDateDisplay(
          p.sampling_date
        )}</td>
        <td>${p.csccn_name || 'N/A'}</td>
        <td style="color:${isFail ? 'red' : 'green'}"><b>${
                p.danh_gia_tu_dong
              }</b></td>
        <td style="color:red; font-size:0.9em">${errs.join(', ')}</td>
      `;

              // Sự kiện click dòng trong bảng để bay tới điểm đó
              row.onclick = () => {
                if (p.lat && p.lng) {
                  map.flyTo([p.lat, p.lng], 15);
                  if (marker) marker.openPopup();

                  if (isFail) {
                    createBufferZone(p.lat, p.lng, 1.0, p.csccn_name);
                    updateRiskPanel(p.lat, p.lng, 1.0);
                  }
                } else {
                  showToast(
                    'warning',
                    'Mẫu này không có tọa độ để hiển thị trên bản đồ.'
                  );
                }
              };
              tbody.appendChild(row);
            }
          });

          // Cập nhật lớp nhiệt
          if (heatmapLayer) heatmapLayer.setLatLngs(heatPoints);
        }
        // FIX LỖI SAI BIẾN Ở ĐÂY
        function geterrs(p) {
          const errs = [];
          if (p.ph < 6.0 || p.ph > 8.5) errs.push(`pH:${p.ph}`);
          if (p.clo_du < 0.2 || p.clo_du > 1) errs.push(`Clo dư:${p.clo_du}`);
          if (
            p.muivi !== null &&
            p.muivi !== undefined &&
            String(p.muivi) !== '0'
          ) {
            errs.push(`Mùi vị: ${p.muivi}`);
          }
          if (p.mau > 15) errs.push(`Màu:${p.mau}`);
          if (p.do_duc > 2) errs.push(`Độ đục:${p.do_duc}`);
          if (p.fe > 0.3) errs.push(`Sắt:${p.fe}`);
          if (p.mangan > 0.1) errs.push(`Mangan:${p.mangan}`);
          if (p.pec > 2) errs.push(`Chỉ số pecmanganat:${p.pec}`);
          if (p.asen > 0.01) errs.push(`Asen:${p.asen}`);
          if (p.coli_tong > 0) errs.push(`Coli:${p.coli_tong}`);
          if (p.ecoli > 0) errs.push(`E.Coli:${p.ecoli}`);
          if (p.ps_aeruginosa > 0)
            errs.push(`Trực khuẩn mủ xanh:${p.ps_aeruginosa}`);
          if (p.staphylococcus_aureus > 0)
            errs.push(`Tụ cầu vàng:${p.staphylococcus_aureus}`);
          ['vs', 'hl_xn', 'hl_mt', 'hl_vs'].forEach((k) => {
            if (p[k] === 'K') errs.push(k.toUpperCase());
          });
          return errs;
        }

        function renderCharts() {
          const total = statsData.length;
          // Tìm phần tử hiển thị thời gian trên Dashboard
          const displayElement = document.getElementById('dashboard-period');
          // Tìm phần tử chứa ngày ở Sidebar
          const sourceElement = document.getElementById('date-label');
          if (displayElement && sourceElement) {
            const currentPeriod = sourceElement.innerText;
            // Nếu source có dữ liệu thì mới hiển thị, nếu không thì báo "Toàn thời gian"
            displayElement.innerHTML = `<i class="far fa-calendar-alt"></i> Giai đoạn báo cáo: ${
              currentPeriod || 'Tất cả'
            }`;
          }
          if (total === 0) return;
          const pass = statsData.filter(
            (d) => d.danh_gia_tu_dong === 'Đạt'
          ).length;
          const fail = total - pass;
          const passRate = ((pass / total) * 100).toFixed(1);
          const failRate = ((fail / total) * 100).toFixed(1);
          const unitCount = [...new Set(statsData.map((d) => d.csccn_name))]
            .length;
          // 1. Cập nhật 4 KPI
          document.getElementById('kpi-total').innerText = total;
          document.getElementById('kpi-pass-rate').innerText = passRate + '%';
          document.getElementById('kpi-fail').innerText = fail;
          document.getElementById('kpi-units').innerText = unitCount;
          const clean = (id) => {
            if (analyticsCharts[id]) analyticsCharts[id].destroy();
          };
          // --- BIỂU ĐỒ 1: TỔNG QUAN (CÓ % TRÊN LABEL) ---
          clean('gen');
          analyticsCharts.gen = new Chart(
            document.getElementById('chartGeneral'),
            {
              type: 'doughnut',
              data: {
                labels: [`Đạt chuẩn (${passRate}%)`, `Vi phạm (${failRate}%)`],
                datasets: [
                  {
                    data: [pass, fail],
                    backgroundColor: ['#008b99', '#f26522'],
                    borderWidth: 0,
                  },
                ],
              },
              options: {
                plugins: {
                  title: {
                    display: true,
                    text: 'PHÂN TÍCH CHẤT LƯỢNG TỔNG THỂ',
                    font: {
                      size: 14,
                    },
                  },
                  legend: {
                    position: 'bottom',
                  },
                },
                cutout: '65%',
              },
            }
          );
          // --- BIỂU ĐỒ 2: THÔNG SỐ LỖI NHIỀU NHẤT (BAR NGANG) ---
          const paramCounts = {};
          statsData
            .filter((d) => d.danh_gia_tu_dong !== 'Đạt')
            .forEach((p) => {
              geterrs(p).forEach((err) => {
                const name = err.split(':')[0];
                paramCounts[name] = (paramCounts[name] || 0) + 1;
              });
            });
          const sortedParams = Object.entries(paramCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);
          clean('params');
          analyticsCharts.params = new Chart(
            document.getElementById('chartParamViolations'),
            {
              type: 'bar',
              data: {
                labels: sortedParams.map((i) => i[0]),
                datasets: [
                  {
                    label: 'Số lần vi phạm',
                    data: sortedParams.map((i) => i[1]),
                    backgroundColor: '#f26522',
                    borderRadius: 4,
                  },
                ],
              },
              options: {
                indexAxis: 'y',
                plugins: {
                  title: {
                    display: true,
                    text: 'TOP THÔNG SỐ KHÔNG ĐẠT',
                    font: {
                      size: 14,
                    },
                  },
                  legend: {
                    display: false,
                  },
                },
              },
            }
          );
          // --- BIỂU ĐỒ 3: NHÓM CHỈ TIÊU (POLAR AREA) ---
          const groups = {
            'Vi sinh': 'vs',
            'Hóa lý': 'hl_xn',
            'Hiện trường': 'hl_mt',
            'Đánh giá chung': 'hl_vs',
          };
          const groupValues = Object.keys(groups).map((key) => {
            const count = statsData.filter(
              (d) => d[groups[key]] === 'K'
            ).length;
            const percent = ((count / total) * 100).toFixed(1);
            return {
              label: `${key} (${percent}%)`,
              value: count,
            };
          });
          clean('group');
          analyticsCharts.group = new Chart(
            document.getElementById('chartByGroup'),
            {
              type: 'polarArea',
              data: {
                labels: groupValues.map((i) => i.label),
                datasets: [
                  {
                    data: groupValues.map((i) => i.value),
                    backgroundColor: [
                      'rgba(155, 89, 182, 0.7)',
                      'rgba(52, 152, 219, 0.7)',
                      '#f26522',
                      '#008b99',
                    ],
                  },
                ],
              },
              options: {
                plugins: {
                  title: {
                    display: true,
                    text: 'TỶ LỆ KHÔNG ĐẠT THEO NHÓM THÔNG SỐ',
                    font: {
                      size: 14,
                    },
                  },
                  legend: {
                    position: 'bottom',
                    labels: {
                      boxWidth: 12,
                      font: {
                        size: 11,
                      },
                    },
                  },
                },
              },
            }
          );
        }
        async function loadHCMBoundary() {
          console.group('🔍 Chẩn đoán tải bản đồ TPHCM');
          try {
            const { data, error } = await supabaseClient
              .from('settings')
              .select('geojson, name')
              .eq('name', 'HCM_Boundaries');
            if (error || !data || data.length === 0) {
              console.error('❌ Không lấy được dữ liệu HCM_Boundaries', error);
              return;
            }
            const geoData = data[0].geojson;
            if (!geoData) {
              console.error('❌ Cột geojson trống!');
              return;
            }
            // === QUAN TRỌNG: LƯU RA GLOBAL ===
            window.hcmGeoJSON = geoData; // ← Dòng này là then chốt
            console.log(
              `✅ Đã load HCM GeoJSON thành công: ${
                geoData.features?.length || 'N/A'
              } features`
            );
            // Vẽ boundary (giữ nguyên)
            boundaryLayer.clearLayers();
            const hcmGeoJson = L.geoJSON(geoData, {
              style: {
                color: '#34495e',
                weight: 1,
                opacity: 1,
                fillColor: '#f39c12',
                fillOpacity: 0.05,
              },
              onEachFeature: (feature, layer) => {
                if (feature.properties?.tenXa) {
                  layer.bindTooltip(feature.properties.tenXa, {
                    sticky: true,
                  });
                }
              },
            }).addTo(boundaryLayer);
            const bounds = hcmGeoJson.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds);
          } catch (err) {
            console.error('❌ Lỗi load boundary:', err);
          } finally {
            console.groupEnd();
          }
        }

        function setupSlider() {
          const slider = document.getElementById('time-slider');
          const startInput = document.getElementById('input-start');
          const endInput = document.getElementById('input-end');
          const label = document.getElementById('date-label');

          if (!allData.length || !slider) return;

          // 1. Tính toán dải dữ liệu
          const dates = allData.map((d) => d.sampling_date.getTime());
          const minDate = Math.min(...dates);
          const now = new Date().getTime();
          const maxDateInData = Math.max(...dates);
          const finalMax = maxDateInData > now ? maxDateInData : now;

          // Mốc mặc định: 30 ngày gần nhất
          const oneMonthInMs = 30 * 24 * 60 * 60 * 1000;
          let defaultStart = now - oneMonthInMs;
          if (defaultStart < minDate) defaultStart = minDate;

          // 2. Khởi tạo Slider
          if (slider.noUiSlider) slider.noUiSlider.destroy();

          noUiSlider.create(slider, {
            start: [defaultStart, finalMax],
            connect: true,
            range: {
              min: minDate,
              max: finalMax,
            },
            step: 24 * 60 * 60 * 1000, // Bước nhảy 1 ngày
          });

          // Hàm phụ: Convert Timestamp sang YYYY-MM-DD cho ô Input
          const toISO = (ts) => new Date(ts).toISOString().split('T')[0];

          // --- A. ĐỒNG BỘ: SLIDER -> INPUT ---
          slider.noUiSlider.on('update', function (values, handle) {
            const s = parseInt(values[0]);
            const e = parseInt(values[1]);

            // Cập nhật nhãn Text (dd/mm/yyyy)
            label.innerText = `${new Date(s).toLocaleDateString(
              'vi-VN'
            )} - ${new Date(e).toLocaleDateString('vi-VN')}`;

            // Cập nhật giá trị ô Input (yyyy-mm-dd)
            if (handle === 0) startInput.value = toISO(s);
            if (handle === 1) endInput.value = toISO(e);

            // Kích hoạt lọc dữ liệu
            applyFilters();
          });

          // --- B. ĐỒNG BỘ: INPUT -> SLIDER ---
          const handleInputChange = () => {
            const valStart = new Date(startInput.value).getTime();
            const valEnd = new Date(endInput.value).getTime();

            // Kiểm tra tính hợp lệ trước khi set lại Slider
            if (valStart && valEnd && valStart <= valEnd) {
              // Chặn việc set vượt quá giới hạn của Slider
              const s = Math.max(minDate, Math.min(valStart, finalMax));
              const e = Math.max(minDate, Math.min(valEnd, finalMax));

              slider.noUiSlider.set([s, e]);
            }
          };

          startInput.addEventListener('change', handleInputChange);
          endInput.addEventListener('change', handleInputChange);
        }

        function toggleTable() {
          const tableArea = document.getElementById('table-area'); // Tác động vào khung tổng
          const icon = document.getElementById('table-toggle-icon');
          // Kiểm tra xem nó đang đóng hay mở
          if (tableArea.classList.contains('table-collapsed')) {
            // ĐANG ĐÓNG -> MỞ RA
            tableArea.classList.remove('table-collapsed');
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
            // Nếu map của bạn bị đen khi mở bảng, hãy gọi dòng này:
            // setTimeout(() => { map.invalidateSize(); }, 300);
          } else {
            // ĐANG MỞ -> ĐÓNG LẠI
            tableArea.classList.add('table-collapsed');
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
          }
        }

        function exportExcel() {
          if (filteredData.length === 0)
            return showToast('warning', 'Không có dữ liệu để xuất!');
          if (event) event.stopPropagation();
          let csv =
            '\uFEFFNgày lấy mẫu,Đơn vị/ CSCCN,Kết luận,Thông số không đạt\n';
          filteredData.forEach((p) => {
            const errs = []; // Thống nhất dùng tên này
            // Kiểm tra các chỉ tiêu số
            if (p.ph < 6.0 || p.ph > 8.5) errs.push(`pH:${p.ph}`);
            if (p.clo_du < 0.2 || p.clo_du > 1) errs.push(`Clo dư:${p.clo_du}`);
            if (
              p.muivi !== null &&
              p.muivi !== undefined &&
              String(p.muivi) !== '0'
            ) {
              errs.push(`Mùi vị: ${p.muivi}`);
            }
            if (p.mau > 15) errs.push(`Màu:${p.mau}`);
            if (p.do_duc > 2) errs.push(`Độ đục:${p.do_duc}`);
            if (p.fe > 0.3) errs.push(`Sắt:${p.fe}`);
            if (p.mangan > 0.1) errs.push(`Mangan:${p.mangan}`);
            if (p.pec > 2) errs.push(`Chỉ số pecmanganat:${p.pec}`);
            if (p.asen > 0.01) errs.push(`Asen:${p.asen}`);
            if (p.coli_tong > 0) errs.push(`Coli:${p.coli_tong}`);
            if (p.ecoli > 0) errs.push(`E.Coli:${p.ecoli}`);
            if (p.ps_aeruginosa > 0)
              errs.push(`Trực khuẩn mủ xanh:${p.ps_aeruginosa}`);
            if (p.staphylococcus_aureus > 0)
              errs.push(`Tụ cầu vàng:${p.staphylococcus_aureus}`);
            // Kiểm tra các nhóm chỉ tiêu định tính (Đ/K)
            ['vs', 'hl_xn', 'hl_mt', 'hl_vs'].forEach((k) => {
              if (p[k] === 'K') errs.push(k.toUpperCase());
            });
            csv += `${p.sampling_date},${p.csccn_name},${
              p.danh_gia_tu_dong
            },${errs.join('|')}\n`;
          });
          const blob = new Blob([csv], {
            type: 'text/csv;charset=utf-8;',
          });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `webGIS_Water_HCDC_${new Date().toLocaleDateString()}.csv`;
          link.click();
        }
        // --- HÀM ĐÓNG/MỞ DASHBOARD ---
        function toggleAnalytics(show) {
          const overlay = document.getElementById('analytics-overlay');
          if (!overlay) return;
          if (show) {
            overlay.style.display = 'flex';
            // Khi mở lên thì vẽ lại biểu đồ ngay để cập nhật số liệu mới nhất
            renderCharts();
          } else {
            overlay.style.display = 'none';
          }
        }

        // 1. TẠO DANH SÁCH NGÀY TỪ date-label (KHÔNG DÙNG SLIDER)
        function generateDateListFromLabel() {
          const dateLabel = document.getElementById('date-label');
          if (!dateLabel) return [];
          // Lấy text từ date-label (ví dụ: "01/03/2026 - 31/03/2026")
          const dateRange = dateLabel.textContent.trim();
          if (!dateRange.includes(' - ')) return [];
          const [startStr, endStr] = dateRange.split(' - ');
          // Parse dd/mm/yyyy → Date object
          const parseDate = (str) => {
            const [day, month, year] = str.split('/').map(Number);
            return new Date(year, month - 1, day);
          };
          try {
            const start = parseDate(startStr);
            const end = parseDate(endStr);
            // Tạo danh sách ngày
            const dates = [];
            let current = new Date(start);
            while (current <= end) {
              dates.push(new Date(current));
              current.setDate(current.getDate() + 1);
            }
            return dates;
          } catch (e) {
            console.error('❌ Lỗi parse date từ label:', e);
            return [];
          }
        }

        function toggleAnimation() {
          const btn = document.getElementById('btn-play');
          const slider = document.getElementById('time-slider');
          if (!slider || !slider.noUiSlider) return;
          // Nếu đang chạy -> Bấm để DỪNG
          if (animationTimer) {
            clearInterval(animationTimer);
            animationTimer = null;
            isAnimating = false;
            // Giữ nguyên ngày hiện tại trên nút để biết đang dừng ở đâu
            const pausedDay = new Date(dateList[currentDateIndex]);
            const dayStr = `${pausedDay
              .getDate()
              .toString()
              .padStart(2, '0')}/${(pausedDay.getMonth() + 1)
              .toString()
              .padStart(2, '0')}`;
            btn.innerHTML = `▶ Tiếp tục <span class="ml-1 date-badge">${dayStr}</span>`;
            btn.classList.remove('btn-danger', 'animate-pulse');
            btn.classList.add('btn-primary');
            return;
          }
          // Nếu đang dừng -> Bấm để CHẠY
          isAnimating = true;
          // 1. Chỉ tạo lại dateList nếu nó đang trống hoặc đã chạy hết
          if (
            dateList.length === 0 ||
            currentDateIndex >= dateList.length - 1
          ) {
            const [startRange, endRange] = slider.noUiSlider
              .get()
              .map((v) => parseInt(v));
            const oneDay = 24 * 60 * 60 * 1000;
            dateList = [];
            for (let t = startRange; t <= endRange; t += oneDay) {
              dateList.push(t);
            }
            currentDateIndex = 0; // Reset về đầu chỉ khi bắt đầu chu kỳ mới
          }
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-danger', 'animate-pulse');
          animationTimer = setInterval(() => {
            if (currentDateIndex >= dateList.length) {
              clearInterval(animationTimer);
              animationTimer = null;
              isAnimating = false;
              btn.innerHTML = `▶ Play`;
              btn.classList.remove('btn-danger', 'animate-pulse');
              btn.classList.add('btn-primary');
              return;
            }
            const currentTimestamp = dateList[currentDateIndex];
            // 🚀 CHẾ ĐỘ SNAPSHOT: Hiện duy nhất ngày hiện tại 🚀
            // Hai giá trị giống nhau [tại đây, tại đây] sẽ ép slider chỉ lấy 1 ngày
            slider.noUiSlider.set([currentTimestamp, currentTimestamp]);
            const d = new Date(currentTimestamp);
            const dayStr = `${d.getDate().toString().padStart(2, '0')}/${(
              d.getMonth() + 1
            )
              .toString()
              .padStart(2, '0')}`;
            btn.innerHTML = `⏸ Tạm dừng <span class="ml-1 date-badge">${dayStr}</span>`;
            applyFilters();
            currentDateIndex++;
          }, 500); // 500ms là tốc độ vừa phải để kịp nhìn bảng thay đổi
        }
        // 3. THÊM CSS CHO HIỆU ỨNG
        const style = document.createElement('style');
        style.textContent = `
  .date-badge {
    background: rgba(0,0,0,0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8em;
    margin-left: 5px;
    min-width: 40px;
    text-align: center;
  }
  .animate-pulse {
    animation: pulse 1s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
  }
`;
        document.head.appendChild(style);
        // 4. KHỞI TẠO
        document.addEventListener('DOMContentLoaded', () => {
          const playBtn = document.getElementById('btn-play');
          if (playBtn) {
            // CẬP NHẬT NGÀY BAN ĐẦU CHO NÚT PLAY
            dateList = generateDateListFromLabel();
            if (dateList.length > 0) {
              const firstDay = dateList[0];
              const dayStr = `${firstDay
                .getDate()
                .toString()
                .padStart(2, '0')}/${(firstDay.getMonth() + 1)
                .toString()
                .padStart(2, '0')}`;
              playBtn.innerHTML = `▶ Play <span class="ml-1 date-badge">${dayStr}</span>`;
            }
            playBtn.addEventListener('click', toggleAnimation);
          }
        });
        // NHẬP EXCEL

        function openImportModal() {
          document.getElementById('import-modal').style.display = 'flex';
        }

        function closeImportModal() {
          document.getElementById('import-modal').style.display = 'none';
          // Reset form
          document.getElementById('excel-file').value = '';
          document.getElementById('import-summary').style.display = 'none';
          document.getElementById('preview-container').style.display = 'none';
          tempValidData = [];
        }
        // Hàm tải cấu hình ngưỡng từ Supabase
        async function loadThresholdConfigs() {
          const { data, error } = await supabaseClient
            .from('threshold_configs')
            .select('*');
          if (error) {
            console.error('❌ Không thể tải ngưỡng giá trị:', error);
            return;
          }
          // Chuyển mảng dữ liệu thành đối tượng để tra cứu nhanh: { ph: { min: 6, max: 8.5 }, ... }
          data.forEach((item) => {
            THRESHOLDS[item.parameter_name] = {
              min: item.min_val,
              max: item.max_val,
            };
          });
        }
        // Gọi hàm này trong init() hoặc ngay khi load trang
        loadThresholdConfigs();
        /**
         * @param {string} icon - 'success', 'error', 'warning', 'info'
         * @param {string} title - Nội dung thông báo
         */
        function showToast(icon, title) {
          Toast.fire({
            icon: icon,
            title: title,
          });
        }
        // 1. Hàm xem trước và đối soát dữ liệu
async function previewExcel(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  
  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      // Đọc file với cellDates để xử lý ngày tháng chuẩn
      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        range: 3,
      });
      const tbody = document.getElementById('preview-body');
      const summaryDiv = document.getElementById('import-summary');
      const containerDiv = document.getElementById('preview-container');
      
      // Reset giao diện
      tbody.innerHTML = '';
      summaryDiv.style.display = 'block'; 
      containerDiv.style.display = 'block';
      tempValidData = [];
      let validCount = 0,
        invalidCount = 0,
        duplicateCount = 0;

      // --- BƯỚC MỚI: Gom tất cả mã mẫu từ Excel để gọi DB cho nhẹ ---
      const excelSampleCodes = [
        ...new Set(
          jsonData.map((row) => row.mamau?.toString().trim()).filter(Boolean)
        ),
      ];

      // 1. TẢI DỮ LIỆU ĐỐI SOÁT (Chỉ tải những mã mẫu có trong file Excel)
      // DB có 2 ràng buộc UNIQUE: (maphuong_temp, sampling_date, sample_code) VÀ sample_code riêng lẻ.
      // => mã mẫu là khóa thật sự; đối soát theo sample_code. Chia lô để URL không quá dài với file lớn.
      const fetchExistingReports = async () => {
        let rows = [];
        for (let i = 0; i < excelSampleCodes.length; i += 150) {
          const { data, error } = await supabaseClient
            .from('water_reports')
            .select('maphuong_temp, sampling_date, sample_code')
            .in('sample_code', excelSampleCodes.slice(i, i + 150));
          if (error) throw error;
          rows = rows.concat(data || []);
        }
        return { data: rows };
      };
      const [resReports, resUnits] = await Promise.all([
        fetchExistingReports(),
        supabaseClient.from('units').select('maphuong').range(0, 10000),
      ]);

      // --- BƯỚC MỚI: Tạo bộ khóa 3 cột (Composite Key) từ DB trả về ---
      const usedSampleCodes = new Set(
        resReports.data?.map((d) => String(d.sample_code).trim()) || []
      );

      const validMaphuongSet = new Set(
        resUnits.data
          ?.map((u) => u.maphuong?.toString().trim().toLowerCase())
          .filter(Boolean) || []
      );
      const VALID_KHUVUC = ['KHUVUC1', 'KHUVUC2', 'KHUVUC3'];
      
      // 2. XỬ LÝ TỪNG HÀNG TRONG EXCEL
      jsonData.forEach((row, index) => {
        let rowErrors = [];
        let isDuplicate = false;
        const sttExcel = row.stt || index + 5;
        
        // --- ĐỐI SOÁT MÃ QUẬN (MAQUAN) ---
        const inputMaquan = row.maquan?.toString().trim();
        const inputMaquanLower = inputMaquan?.toLowerCase();

        if (inputMaquan) {
          const isKhuVucValid = VALID_KHUVUC.includes(inputMaquan);
          const isStationIDValid = validMaphuongSet.has(inputMaquanLower);

          if (!isKhuVucValid && !isStationIDValid) {
            rowErrors.push(
              `Mã quận '${inputMaquan}' không hợp lệ. Phải là mã khu vực (KHUVUC1/2/3) hoặc mã định danh Trạm/CSCCN.`
            );
          }
        }

        // --- ĐỐI SOÁT MÃ PHƯỜNG (MAPHUONG_TEMP) ---
        const inputMaphuong = (
          row.maphuong ||
          row['Đơn vị/CSCCN'] ||
          row.maphuong_excel ||
          row.maphuong_temp
        )?.toString().trim();

        const inputMaphuongLower = inputMaphuong?.toLowerCase();

        if (!inputMaphuong) {
          rowErrors.push('Trống mã phường (Đơn vị lấy mẫu)');
        } else if (!validMaphuongSet.has(inputMaphuongLower)) {
          rowErrors.push(
            `Mã phường '${inputMaphuong}' không tồn tại trong hệ thống`
          );
        }
        
        // --- XỬ LÝ NGÀY THÁNG ---
        let displayDate = '';
        let dbDate = '';
        if (row.ngaylaymau) {
          let d = row.ngaylaymau;
          if (d instanceof Date && !isNaN(d)) {
            const offset = d.getTimezoneOffset() * 60000;
            const localDate = new Date(d.getTime() + offset);
            let day = String(localDate.getDate()).padStart(2, '0');
            let month = String(localDate.getMonth() + 1).padStart(2, '0');
            let year = localDate.getFullYear();
            displayDate = `${day}-${month}-${year}`;
            dbDate = `${year}-${month}-${day}`;
          } else if (typeof d === 'string') {
            const parts = d.trim().split(/[-/]/);
            if (parts.length === 3) {
              displayDate = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
              dbDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
        }
        if (!dbDate) rowErrors.push('Ngày sai định dạng (dd-mm-yyyy)');
        
        // --- ĐỐI SOÁT TRÙNG DB DỰA TRÊN 3 CỘT (Khớp 100% với Database) ---
        const sampleCode = row.mamau?.toString().trim();
        const rowCompositeKey = `${inputMaphuong}_${dbDate}_${sampleCode}`;

        if (!sampleCode) {
          rowErrors.push('Thiếu mã mẫu (mamau)');
        } else if (usedSampleCodes.has(sampleCode)) {
          isDuplicate = true; // Mã mẫu đã có trên DB (khóa UNIQUE)
        }
        
        const isValid = rowErrors.length === 0;
        if (isValid) {
          validCount++;
          if (isDuplicate) duplicateCount++;
          
          let cleanData = { ...row };
          cleanData.sample_code = sampleCode;
          cleanData.maphuong_temp = inputMaphuong;
          cleanData.sampling_date = dbDate;
          cleanData.lat = parseFloat(row.lat);
          cleanData.lng = parseFloat(row.lng);
          delete cleanData.mamau; 
          delete cleanData.maphuong;
          delete cleanData.ngaylaymau;
          delete cleanData.maquan; 
          
          tempValidData.push(cleanData);
        } else {
          invalidCount++;
        }
        
        // --- HIỂN THỊ DỮ LIỆU LÊN BẢNG ---
        const tr = document.createElement('tr');
        if (!isValid) tr.className = 'table-danger';
        else if (isDuplicate) tr.className = 'table-warning';
        
        tr.innerHTML = `
          <td class="text-center"><strong>${sttExcel}</strong></td>
          <td>${inputMaphuong || '---'}</td>
          <td>${row.diachi || '---'}</td>
          <td>${row.loaimau_id || '---'}</td>
          <td>${displayDate || row.ngaylaymau || '---'}</td>
          <td>${sampleCode || '---'}</td>
          <td class="text-center"><strong>${
            row.vs || row.danh_gia_tu_dong || '---'
          }</strong></td>
          <td>${row.lat || '---'}</td>
          <td>${row.lng || '---'}</td>
          <td class="small">
            ${
              isValid
                ? isDuplicate
                  ? '<span class="badge badge-warning">⚠️ Đã có trên DB</span>'
                  : '<span class="badge badge-success">✅ OK</span>'
                : `<div class="text-danger"><strong>❌ Lỗi:</strong><br>${rowErrors.join(
                    '<br>'
                  )}</div>`
            }
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      // 3. HIỂN THỊ TỔNG KẾT
      summaryDiv.innerHTML = `
        <div class="import-dashboard shadow-sm">
            <div class="dashboard-item">
                <div class="dashboard-value text-dark">${jsonData.length}</div>
                <div class="dashboard-label">Tổng cộng</div>
            </div>
            <div class="dashboard-item">
                <div class="dashboard-value text-success">${
                  validCount - duplicateCount
                }</div>
                <div class="dashboard-label">Mới</div>
            </div>
            <div class="dashboard-item">
                <div class="dashboard-value text-warning">${duplicateCount}</div>
                <div class="dashboard-label">Trùng (Cần ghi đè)</div>
            </div>
            <div class="dashboard-item">
                <div class="dashboard-value text-danger">${invalidCount}</div>
                <div class="dashboard-label">Lỗi</div>
            </div>
        </div>
      `;
      
      document.getElementById('btn-final-import').disabled = validCount === 0;
      input.value = ''; 
    } catch (err) {
      console.error('Lỗi previewExcel:', err);
      showToast('error', 'Không thể đọc dữ liệu: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}
        // EXCEUTE WRITING EXCEL TO DATABASE
async function executeImport() {
  if (tempValidData.length === 0) return;

  const btn = document.getElementById('btn-final-import');
  const isOverwrite = document.getElementById('overwrite-checkbox').checked;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

  try {
    // --- BƯỚC 1: Lọc trùng nội bộ file dựa trên 3 CỘT chuẩn ---
    // Khóa gộp (Composite Key) để kiểm tra trùng: maphuong + ngay + mamau
    // Lọc trùng nội bộ file theo sample_code (khóa UNIQUE thật của DB; dòng sau thắng dòng trước)
    const uniqueData = Array.from(
      new Map(tempValidData.map((item) => [item.sample_code, item])).values()
    );

    console.log(
      `Đang nạp: ${uniqueData.length} dòng (Đã lọc bỏ trùng lặp nội bộ dựa trên 3 cột định danh)`
    );

    let result;
    if (isOverwrite) {
      // --- BƯỚC 2: Dùng upsert với onConflict khớp 100% DB ---
      result = await supabaseClient
        .from('water_reports')
        .upsert(uniqueData, {
          onConflict: 'sample_code', // sample_code là khóa UNIQUE; ghi đè cả khi đổi phường/ngày
        });
    } else {
      // Dùng insert nếu không ghi đè
      result = await supabaseClient
        .from('water_reports')
        .insert(uniqueData);
    }

    if (result.error) throw result.error;

    // Lưu ý: Thông báo này chỉ mang tính chất báo "Đã quét và xử lý thành công X dòng từ file Excel".
    // Việc ghi đè hay thêm mới đã được DB tự động làm ngầm.
    showToast(
      'success',
      `Thành công! Đã quét và xử lý ${uniqueData.length} mẫu vào hệ thống.`
    );
    
    closeImportModal();
    if (typeof init === 'function') init();
    
  } catch (err) {
    console.error('Lỗi insert/upsert:', err);
    
    let msg = err.message;
    // Bắt lỗi khi không tick "Ghi đè" nhưng dữ liệu lại bị trùng
    if (err.code === '23505') {
      msg = isOverwrite
        ? 'Vi phạm ràng buộc duy nhất dù đã chọn ghi đè: ' + (err.details || err.message)
        : "Phát hiện mã mẫu đã tồn tại trong hệ thống. Vui lòng chọn 'Đồng ý ghi đè' để cập nhật.";
    }
    if (err.code === '21000') {
      msg = 'Có lỗi cấu trúc dữ liệu, vui lòng kiểm tra lại file Excel.';
    }

    showToast('error', 'Lỗi: ' + msg);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Xác nhận nhập vào Database';
  }
}
        // Hàm hỗ trợ xử lý ngày tháng Excel (vẫn giữ lại từ bước trước vì rất quan trọng)
        function formatExcelDate(serial) {
          if (!serial) return null;
          if (typeof serial === 'string' && serial.includes('/')) {
            const [d, m, y] = serial.split('/');
            return `${y}-${m}-${d}`;
          }
          // Nếu Excel trả về số Serial (ví dụ 45352)
          const date = XLSX.utils.format_cell({
            t: 'd',
            v: serial,
          });
          return date; // YYYY-MM-DD
        }
        //TABLE ANALYTICS
        async function loadAnalyticsData() {
          // 1. Xác định giai đoạn để hiển thị tiêu đề (Giữ nguyên logic của sếp)
          const sourceElement = document.getElementById('date-label');
          let startDate = '',
            endDate = '';
          if (sourceElement) {
            const dates = sourceElement.innerText.split(' - ');
            if (dates.length === 2) {
              startDate = formatDateForQuery(dates[0]);
              endDate = formatDateForQuery(dates[1]);
            }
          }

          const displayElement = document.getElementById('table-period');
          if (displayElement) {
            displayElement.innerHTML = `<i class="far fa-calendar-alt me-2"></i> Giai đoạn: <b>${formatDateDisplay(
              startDate
            )}</b> đến <b>${formatDateDisplay(endDate)}</b>`;
          }

          try {
            // 2. Tải danh mục (Chỉ tải 1 lần duy nhất)
            if (!cacheUnits || !cacheThresholds) {
              const [resUnits, resThresholds] = await Promise.all([
                supabaseClient
                  .from('units')
                  .select('maphuong, csccn_name, capacity')
                  .eq('mode', 'noikiem'),
                supabaseClient
                  .from('threshold_configs')
                  .select('param_code, limit_min, limit_max'),
              ]);
              cacheUnits = resUnits.data;
              cacheThresholds = resThresholds.data;
            }

            // 3. CHIẾN THUẬT ĐỒNG BỘ:
            // Nếu filteredData đã có (do người dùng bóp filter), ta dùng nó luôn.
            // Nếu chưa có (mới load trang), ta mới đi fetch từ Supabase.
            let dataToAnalyze = [];

            if (
              typeof filteredData !== 'undefined' &&
              filteredData.length > 0
            ) {
              // Dùng ngay dữ liệu sếp vừa lọc ở ngoài Map/Table
              dataToAnalyze = filteredData;
            } else {
              // Trường hợp dự phòng nếu chưa có dữ liệu lọc
              showToast('info', 'Đang tải dữ liệu gốc...');
              let from = 0;
              let to = 999;
              let hasMore = true;
              while (hasMore) {
                const { data: batch, error } = await supabaseClient
                  .from('water_reports')
                  .select('*')
                  .filter('sampling_date', 'gte', startDate || '2024-01-01')
                  .filter('sampling_date', 'lte', endDate || '2026-12-31')
                  .range(from, to);
                if (error) throw error;
                dataToAnalyze = dataToAnalyze.concat(batch);
                if (batch.length < 1000) hasMore = false;
                else {
                  from += 1000;
                  to += 1000;
                }
              }
            }

            // 4. CHUẨN BỊ MAP & RENDER (Đồng bộ 100% với Filter)
            const thresholdMap = new Map(
              cacheThresholds.map((t) => [t.param_code, t])
            );
            const unitMap = Object.fromEntries(
              cacheUnits.map((u) => [u.maphuong, u.csccn_name])
            );

            renderComplianceTable(dataToAnalyze, cacheUnits);
            renderSummaryTable(dataToAnalyze, unitMap, thresholdMap);
            renderDetailTable(dataToAnalyze, thresholdMap);
            renderAlertTable(dataToAnalyze, unitMap, thresholdMap);

            showToast(
              'success',
              `Phân tích hoàn tất trên ${dataToAnalyze.length} mẫu đã chọn.`
            );
          } catch (err) {
            console.error('Lỗi phân tích:', err);
            showToast('error', 'Lỗi dữ liệu: ' + err.message);
          }
        }

        // Hàm hỗ trợ định dạng dd-mm-yyyy để hiển thị
        function formatDateDisplay(dateInput) {
          if (!dateInput) return '';

          // Nếu là đối tượng Date (do mình đã convert ở hàm init)
          if (dateInput instanceof Date) {
            if (isNaN(dateInput.getTime())) return '';
            const d = String(dateInput.getDate()).padStart(2, '0');
            const m = String(dateInput.getMonth() + 1).padStart(2, '0');
            const y = dateInput.getFullYear();
            return `${d}-${m}-${y}`;
          }

          // Nếu là chuỗi (String) dạng YYYY-MM-DD
          if (typeof dateInput === 'string' && dateInput.includes('-')) {
            const parts = dateInput.split('T')[0].split('-'); // Cắt bỏ phần giờ nếu có
            if (parts.length === 3)
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }

          return dateInput;
        }
        function handleResize() {
          const mapContainer = document.getElementById('map');
          const tableContainer = document.getElementById('table-area');
          const mainContainer = document.getElementById('main');

          if (map) {
            map.invalidateSize(); // Quan trọng: Yêu cầu Leaflet tính toán lại khung nhìn
          }

          if (mainContainer && mapContainer && tableContainer) {
            const containerHeight = mainContainer.offsetHeight;
            const mapHeight = mapContainer.offsetHeight;
            // Tính toán lại chiều cao bảng để không bị tràn màn hình
            tableContainer.style.maxHeight =
              containerHeight - mapHeight - 20 + 'px';
          }
        }
        /**
         * Tìm và zoom đến điểm trên bản đồ dựa vào ID mẫu tin
         * @param {string} id - ID của record trong water_reports
         */
        function focusMap(id) {
          // 1. Tắt ngay cái bảng đang che mắt chúng ta
          toggleTables(false);

          // 2. Tìm điểm vi phạm trên bản đồ
          let targetMarker = null;
          window.map.eachLayer((layer) => {
            // Kiểm tra xem layer có phải marker và có ID khớp không
            if (layer instanceof L.Marker && layer.options.id === id) {
              targetMarker = layer;
            }
          });

          if (targetMarker) {
            // 3. Thực hiện cú "bay" tới điểm vi phạm (Zoom 18 cho rõ nhà dân luôn)
            window.map.flyTo(targetMarker.getLatLng(), 18, {
              animate: true,
              duration: 1.5, // Thời gian bay 1.5 giây cho mượt
            });

            // 4. Bay xong thì tự động bung Popup thông tin
            setTimeout(() => {
              targetMarker.openPopup();
            }, 1600);
          } else {
            showToast('error', 'Không tìm thấy vị trí mẫu này trên bản đồ!');
          }
        }
        // HÀM SỬA LỖI CHÍNH: Kiểm tra và tạo tbody nếu thiếu
        function getTableBody(tableId, headHtml) {
          const table = document.getElementById(tableId);
          if (!table) return null;

          if (table.innerHTML.trim() === '') {
            table.innerHTML = headHtml + '<tbody></tbody>';
          }
          return table.querySelector('tbody');
        }
        function formatDateForQuery(dateStr) {
          if (!dateStr) return '';
          const parts = dateStr.trim().split('/');
          if (parts.length === 3) {
            // parts[2]: YYYY, parts[1]: MM, parts[0]: DD
            return `${parts[2]}-${parts[1].padStart(
              2,
              '0'
            )}-${parts[0].padStart(2, '0')}`;
          }
          return dateStr;
        }
        /**
         * Render bảng Cảnh báo vi phạm (Tab 3)
         * Tích hợp 12 quy tắc cảnh báo từ lý hóa đến vi sinh
         */
        function renderAlertTable(reports, unitMap, thresholdMap) {
          const head = `
        <thead class="table-light sticky-top text-center">
            <tr>
                <th style="width: 20%">Đơn vị Giám sát</th>
                <th style="width: 15%" class="text-center">Mức độ</th>
                <th style="width: 50%">Nội dung cảnh báo</th>
                <th style="width: 15%" class="text-center">Hành động</th>
            </tr>
        </thead>`;

          const tbody = getTableBody('table-analytic-canhbao', head);
          if (!tbody) return;

          const alerts = [];

          reports.forEach((p) => {
            let errs = [];
            let isCritical = false;

            // --- NHÓM VI SINH & ĐỘC CHẤT (NGHIÊM TRỌNG) ---
            if (
              p.ecoli > 0 ||
              (typeof p.ecoli === 'string' && p.ecoli.includes('Dương'))
            ) {
              errs.push(
                `<span class="text-danger fw-bold">E.Coli: ${p.ecoli}</span>`
              );
              isCritical = true;
            }
            if (p.coli_tong > 0) {
              errs.push(`Coliform: ${p.coli_tong}`);
              isCritical = true;
            }
            if (p.ps_aeruginosa > 0) {
              errs.push(`Trực khuẩn mủ xanh: ${p.ps_aeruginosa}`);
              isCritical = true;
            }
            if (p.asen > 0.01) {
              errs.push(`Asen: ${p.asen}`);
              isCritical = true;
            }

            // --- NHÓM LÝ HÓA & CẢM QUAN (NHẮC NHỞ) ---
            if (p.ph < 6.0 || p.ph > 8.5) errs.push(`pH: ${p.ph}`);
            if (p.clo_du < 0.2 || p.clo_du > 1)
              errs.push(`Clo dư: ${p.clo_du}`);
            if (
              p.muivi !== null &&
              p.muivi !== undefined &&
              String(p.muivi) !== '0' &&
              String(p.muivi).toLowerCase() !== 'không'
            ) {
              errs.push(`Mùi vị: ${p.muivi}`);
            }
            if (p.mau > 15) errs.push(`Màu sắc: ${p.mau}`);
            if (p.do_duc > 2) errs.push(`Độ đục: ${p.do_duc}`);
            if (p.fe > 0.3) errs.push(`Sắt: ${p.fe}`);
            if (p.mangan > 0.1) errs.push(`Mangan: ${p.mangan}`);
            if (p.pec > 2) errs.push(`Chỉ số Pecmanganat: ${p.pec}`);

            // Nếu có lỗi thì đẩy vào danh sách hiển thị
            if (errs.length > 0) {
              const levelBadge = isCritical
                ? '<span class="badge bg-danger">NGHIÊM TRỌNG</span>'
                : '<span class="badge bg-warning text-dark">NHẮC NHỞ</span>';

              alerts.push(`
                <tr>
                    <td class="fw-bold text-dark">${
                      unitMap[p.maphuong_temp] || p.maphuong_temp
                    }</td>
                    <td class="text-center">${levelBadge}</td>
                    <td class="small">
                        <div class="d-flex flex-wrap gap-1">
                            ${errs
                              .map(
                                (e) =>
                                  `<span class="border rounded px-1 bg-light">${e}</span>`
                              )
                              .join('')}
                        </div>
                        <div class="mt-1 text-muted italic" style="font-size: 10px;">Ngày lấy mẫu: ${formatDateDisplay(
                          p.sampling_date
                        )}</div>
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-danger shadow-sm" title="Định vị trên bản đồ" onclick="focusMap('${
                          p.id
                        }')">
                            <i class="fas fa-map-marker-alt"></i>
                        </button>
                    </td>
                </tr>`);
            }
          });

          tbody.innerHTML = alerts.length
            ? alerts.join('')
            : '<tr><td colspan="4" class="text-center p-4 text-success"><i class="fas fa-check-circle me-2"></i>Không có vi phạm nào được ghi nhận.</td></tr>';
        }

        // Tương tự, hãy cập nhật renderDetailTable và renderSummaryTable dùng hàm getTableBody
        function checkStatus(paramCode, value, thresholdMap) {
          if (
            value === null ||
            value === undefined ||
            value === '' ||
            value === 'N/A'
          )
            return true;

          const config = thresholdMap.get(paramCode);
          if (!config) return true;

          const val = parseFloat(value);
          const min =
            config.limit_min !== null
              ? parseFloat(config.limit_min)
              : -Infinity;
          const max =
            config.limit_max !== null ? parseFloat(config.limit_max) : Infinity;

          // Vi sinh: Đạt khi bằng 0 hoặc ghi "Không phát hiện"
          if (
            [
              'coli_tong',
              'ecoli',
              'ps_aeruginosa',
              'staphylococcus_aureus',
            ].includes(paramCode)
          ) {
            return (
              val === 0 || value.toString().toLowerCase().includes('không')
            );
          }

          return val >= min && val <= max;
        }
        /**
         * Render bảng Tổng hợp (Tab 1) - 12 cột
         */
        function renderSummaryTable(reports, unitMap, thresholdMap) {
          const headSummary = `
        <thead class="table-light sticky-top text-center">
            <tr>
                <th rowspan="2" class="align-middle bg-light">Đơn vị Giám sát</th>
                <th rowspan="2" class="align-middle bg-light">Số Mẫu</th>
                <th colspan="3" class="bg-primary text-white">Hóa lý</th>
                <th colspan="3" class="bg-success text-white">Vi sinh</th>
                <th colspan="3" class="bg-warning text-dark">Đánh giá chung</th>
            </tr>
            <tr class="small">
                <th>Đạt</th><th>Không đạt</th><th>Tỷ lệ đạt (%)</th>
                <th>Đạt</th><th>Không đạt</th><th>Tỷ lệ đạt (%)</th>
                <th>Đạt</th><th>Không đạt</th><th>Tỷ lệ đạt (%)</th>
            </tr>
        </thead>`;

          const tbody = getTableBody('table-analytic-tonghop', headSummary);
          if (!tbody) return;

          const MICRO_KEYS = [
            'coli_tong',
            'ecoli',
            'ps_aeruginosa',
            'staphylococcus_aureus',
          ];
          const summary = {};

          // Khởi tạo biến lưu tổng cộng toàn thành phố
          const grandTotal = {
            total: 0,
            hl_ok: 0,
            hl_fail: 0,
            vs_ok: 0,
            vs_fail: 0,
            all_ok: 0,
            all_fail: 0,
          };

          reports.forEach((r) => {
            const wardId = r.maphuong_temp;
            if (!summary[wardId]) {
              summary[wardId] = {
                total: 0,
                hl_ok: 0,
                hl_fail: 0,
                vs_ok: 0,
                vs_fail: 0,
                all_ok: 0,
                all_fail: 0,
              };
            }

            const s = summary[wardId];
            s.total++;
            grandTotal.total++;

            let isHlFail = false;
            let isVsFail = false;

            Object.keys(r).forEach((key) => {
              const val = r[key];
              if (
                val !== undefined &&
                val !== null &&
                val !== '' &&
                thresholdMap.has(key)
              ) {
                if (!checkStatus(key, val, thresholdMap)) {
                  if (MICRO_KEYS.includes(key)) isVsFail = true;
                  else isHlFail = true;
                }
              }
            });

            if (!isHlFail) {
              s.hl_ok++;
              grandTotal.hl_ok++;
            } else {
              s.hl_fail++;
              grandTotal.hl_fail++;
            }
            if (!isVsFail) {
              s.vs_ok++;
              grandTotal.vs_ok++;
            } else {
              s.vs_fail++;
              grandTotal.vs_fail++;
            }
            if (!isHlFail && !isVsFail) {
              s.all_ok++;
              grandTotal.all_ok++;
            } else {
              s.all_fail++;
              grandTotal.all_fail++;
            }
          });

          const getRate = (ok, total) =>
            total > 0 ? ((ok / total) * 100).toFixed(1) : '0.0';

          // Tạo hàng cho từng đơn vị
          let rowsHtml = Object.entries(summary)
            .map(([id, data]) => {
              return `
            <tr>
                <td class="fw-bold">${unitMap[id] || id}</td>
                <td class="text-center fw-bold bg-light">${data.total}</td>
                <td class="text-center text-success">${data.hl_ok}</td>
                <td class="text-center ${
                  data.hl_fail > 0 ? 'text-danger fw-bold' : 'text-muted'
                }">${data.hl_fail}</td>
                <td class="text-center small">${getRate(
                  data.hl_ok,
                  data.total
                )}%</td>
                <td class="text-center text-success">${data.vs_ok}</td>
                <td class="text-center ${
                  data.vs_fail > 0 ? 'text-danger fw-bold' : 'text-muted'
                }">${data.vs_fail}</td>
                <td class="text-center small">${getRate(
                  data.vs_ok,
                  data.total
                )}%</td>
                <td class="text-center text-success">${data.all_ok}</td>
                <td class="text-center ${
                  data.all_fail > 0 ? 'text-danger fw-bold' : 'text-muted'
                }">${data.all_fail}</td>
                <td class="text-center fw-bold bg-light">${getRate(
                  data.all_ok,
                  data.total
                )}%</td>
            </tr>`;
            })
            .join('');

          // Thêm hàng TỔNG CỘNG vào cuối
          if (grandTotal.total > 0) {
            rowsHtml += `
            <tr class="table-secondary fw-bold border-top border-dark">
                <td class="text-center uppercase">TỔNG CỘNG</td>
                <td class="text-center bg-dark text-white">${
                  grandTotal.total
                }</td>
                <td class="text-center text-success">${grandTotal.hl_ok}</td>
                <td class="text-center text-danger">${grandTotal.hl_fail}</td>
                <td class="text-center">${getRate(
                  grandTotal.hl_ok,
                  grandTotal.total
                )}%</td>
                <td class="text-center text-success">${grandTotal.vs_ok}</td>
                <td class="text-center text-danger">${grandTotal.vs_fail}</td>
                <td class="text-center">${getRate(
                  grandTotal.vs_ok,
                  grandTotal.total
                )}%</td>
                <td class="text-center text-success">${grandTotal.all_ok}</td>
                <td class="text-center text-danger">${grandTotal.all_fail}</td>
                <td class="text-center bg-warning text-dark">${getRate(
                  grandTotal.all_ok,
                  grandTotal.total
                )}%</td>
            </tr>`;
          }

          tbody.innerHTML =
            rowsHtml ||
            '<tr><td colspan="11" class="text-center p-3">Không có dữ liệu trong khoảng thời gian này.</td></tr>';
        }
        /**
         * Render bảng Chi tiết thông số (Tab 2)
         */
        function renderDetailTable(reports, thresholdMap) {
          const headDetail = `
        <thead class="table-dark sticky-top text-center">
            <tr>
                <th>Tên thông số</th>
                <th>Mã thông số</th>
                <th>Số mẫu đo</th>
                <th>Số mẫu Đạt</th>
                <th>Số mẫu không đạt</th>
                <th>Tỷ lệ đạt (%)</th>
            </tr>
        </thead>`;

          const tbody = getTableBody('table-analytic-chitieu', headDetail);
          if (!tbody) return;

          const rows = WATER_PARAMS.map((param) => {
            let count = 0,
              ok = 0,
              fail = 0;

            reports.forEach((r) => {
              const val = r[param.key];
              if (
                val !== undefined &&
                val !== null &&
                val !== '' &&
                val !== 'N/A'
              ) {
                count++;
                if (checkStatus(param.key, val, thresholdMap)) ok++;
                else fail++;
              }
            });

            if (count === 0) return ''; // Không hiện nếu không có dữ liệu

            const rate = ((ok / count) * 100).toFixed(1);
            return `
            <tr>
                <td class="fw-bold">${param.name}</td>
                <td class="text-center"><code class="small">${
                  param.key
                }</code></td>
                <td class="text-center fw-bold">${count}</td>
                <td class="text-center text-success">${ok}</td>
                <td class="text-center ${
                  fail > 0 ? 'text-danger fw-bold' : 'text-muted'
                }">${fail || '-'}</td>
                <td class="text-center">
                    <span class="badge ${
                      rate < 100 ? 'bg-danger' : 'bg-success'
                    } shadow-sm">${rate}%</span>
                </td>
            </tr>`;
          }).join('');

          tbody.innerHTML =
            rows ||
            '<tr><td colspan="6" class="text-center p-3">Chưa có thông số đo.</td></tr>';
        }
        // Khởi tạo tab
        // LƯU Ý: nhiều nhóm tab khác nhau dùng CHUNG class "tab-button"
        // (vd tab-nav "Thống kê & Phân tích" dùng data-tab, còn tab-nav
        // modal "KẾT QUẢ NGHIÊN CỨU" - Module 5 - dùng data-research-tab
        // và tự xử lý qua switchResearchTab()). Listener này CHỈ được xử
        // lý cho nhóm dùng data-tab; nếu nút bấm không có data-tab (vd
        // nút của modal nghiên cứu) thì bỏ qua, tránh gọi getElementById
        // với id rỗng/không tồn tại rồi crash .classList trên null.
        document.addEventListener('click', function (e) {
          if (e.target.classList.contains('tab-button')) {
            const tabId = e.target.getAttribute('data-tab');
            if (!tabId) return; // Nút thuộc nhóm tab khác (vd data-research-tab) -> bỏ qua

            // Active nút
            document
              .querySelectorAll('.tab-button')
              .forEach((btn) => btn.classList.remove('active'));
            e.target.classList.add('active');

            // Active nội dung
            document
              .querySelectorAll('.tab-panel')
              .forEach((panel) => panel.classList.remove('active'));
            const targetPanel = document.getElementById('tab-' + tabId);
            if (targetPanel) {
              targetPanel.classList.add('active');
            } else {
              console.warn(`⚠️ Không tìm thấy panel #tab-${tabId} (kiểm tra lại id trong index.html).`);
            }
          }
        });
        // Chuyển tab
        function switchTab(tabName) {
          // Xóa active tất cả button
          document.querySelectorAll('.tab-button').forEach((btn) => {
            btn.classList.remove('active');
          });

          // Thêm active cho button được chọn
          const activeBtn = document.querySelector(
            `.tab-button[data-tab="${tabName}"]`
          );
          if (activeBtn) activeBtn.classList.add('active');

          // Ẩn tất cả panel
          document.querySelectorAll('.tab-panel').forEach((panel) => {
            panel.classList.remove('active');
          });

          // Hiện panel tương ứng
          const panel = document.getElementById(`tab-${tabName}`);
          if (panel) panel.classList.add('active');
        }

        // Khởi tạo sự kiện click cho tab
        function initTabEvents() {
          document.querySelectorAll('.tab-button').forEach((button) => {
            button.addEventListener('click', () => {
              const tabName = button.getAttribute('data-tab');
              switchTab(tabName);
            });
          });
        }

        // Toggle overlay
        function toggleTables(show) {
          const overlay = document.getElementById('tables-overlay');
          if (!overlay) return;

          if (show) {
            overlay.style.display = 'flex';

            // Mở tab mặc định là "Tổng hợp"
            setTimeout(() => {
              switchTab('tonghop');
              if (typeof loadAnalyticsData === 'function') {
                loadAnalyticsData();
              }
            }, 100);
          } else {
            overlay.style.display = 'none';
          }
        }
        /**
         * Tính định mức mẫu dựa trên công suất (Hàm của bạn)
         */
        function getRequiredSamples(capacity) {
          if (!capacity || capacity <= 0) return 0;
          let monthlyQuota = 0;
          if (capacity < 1000) monthlyQuota = 2;
          else if (capacity < 15000) monthlyQuota = 3;
          else if (capacity < 30000) monthlyQuota = 4;
          else monthlyQuota = 4 + Math.floor((capacity - 30000) / 15000);

          return monthlyQuota * 3; // Định mức Quý
        }

        /**
         * Render bảng theo dõi tiến độ nộp mẫu (Bản đã sửa lỗi Filter)
         */
        function renderComplianceTable(reports, units) {
          const head = `
    <thead class="table-dark sticky-top">
        <tr>
            <th>Đơn vị/CSCCN</th>
            <th class="text-center">Công suất (m³/đêm)</th>
            <th class="text-center">Định mức (Quý)</th>
            <th class="text-center">Thực tế nộp</th>
            <th class="text-center">Tỷ lệ hoàn thành</th>
            <th class="text-center">Trạng thái</th>
        </tr>
    </thead>`;

          const tbody = getTableBody('table-analytic-tiendo', head);
          if (!tbody) return;

          // --- BƯỚC QUAN TRỌNG: LỌC ĐƠN VỊ THEO FILTER ---
          // Lấy giá trị ward đang chọn ở ngoài giao diện
          const currentWardFilter =
            document.getElementById('f-ward')?.value || 'all';

          // Chỉ giữ lại những đơn vị khớp với lựa chọn của sếp
          const filteredUnits = units.filter(
            (u) =>
              currentWardFilter === 'all' || u.csccn_name === currentWardFilter
          );

          // 1. Thống kê số mẫu nộp (Chỉ tính từ danh sách reports đã lọc)
          const actualCountMap = {};
          reports.forEach((r) => {
            // Lưu ý: Dùng maphuong_temp hoặc maphuong tùy theo cấu trúc data của sếp
            const id = r.maphuong_temp || r.maphuong;
            actualCountMap[id] = (actualCountMap[id] || 0) + 1;
          });

          // Khởi tạo các biến tích lũy cho hàng Tổng cộng
          let totalCap = 0,
            totalReq = 0,
            totalAct = 0;

          // 2. Duyệt danh sách đơn vị ĐÃ LỌC để tạo hàng dữ liệu
          let rowsHtml = filteredUnits
            .map((u) => {
              const cap = u.capacity || 0;
              const required = getRequiredSamples(cap);
              const actual = actualCountMap[u.maphuong] || 0;
              const progress =
                required > 0 ? ((actual / required) * 100).toFixed(1) : 0;

              // Tích lũy số liệu (Chỉ tích lũy những gì đang hiển thị)
              totalCap += cap;
              totalReq += required;
              totalAct += actual;

              let status =
                actual >= required
                  ? '<span class="badge bg-success"><i class="fas fa-check"></i> Đạt</span>'
                  : `<span class="badge bg-warning text-dark">Thiếu ${
                      required - actual
                    }</span>`;

              return `
        <tr>
            <td class="fw-bold">${u.csccn_name}</td>
            <td class="text-center text-muted small">${cap.toLocaleString()}</td>
            <td class="text-center fw-bold text-primary">${required}</td>
            <td class="text-center">${actual}</td>
            <td class="text-center">
                <div class="progress" style="height: 8px; margin-bottom: 2px;">
                    <div class="progress-bar ${
                      progress >= 100 ? 'bg-success' : 'bg-info'
                    }" 
                         style="width: ${Math.min(progress, 100)}%"></div>
                </div>
                <small style="font-size: 10px;">${progress}%</small>
            </td>
            <td class="text-center">${status}</td>
        </tr>`;
            })
            .join('');

          // 3. THÊM HÀNG TỔNG CỘNG (Chỉ hiện nếu có dữ liệu)
          if (filteredUnits.length > 0) {
            const totalProgress =
              totalReq > 0 ? ((totalAct / totalReq) * 100).toFixed(1) : 0;

            rowsHtml += `
    <tr class="table-secondary fw-bold border-top border-dark">
        <td class="text-center">${
          currentWardFilter === 'all'
            ? 'TỔNG CỘNG HỆ THỐNG'
            : 'TỔNG CỘNG LỰA CHỌN'
        }</td>
        <td class="text-center">${totalCap.toLocaleString()}</td>
        <td class="text-center text-primary">${totalReq}</td>
        <td class="text-center text-dark">${totalAct}</td>
        <td class="text-center">
            <div class="progress" style="height: 12px; margin-bottom: 2px;">
                <div class="progress-bar ${
                  totalProgress >= 100 ? 'bg-success' : 'bg-warning'
                }" 
                     style="width: ${Math.min(totalProgress, 100)}%"></div>
            </div>
            <span class="small">${totalProgress}%</span>
        </td>
        <td class="text-center">
            ${
              totalAct >= totalReq
                ? '<span class="text-success small">HOÀN THÀNH</span>'
                : `<span class="text-danger small">THIẾU ${
                    totalReq - totalAct
                  } MẪU</span>`
            }
        </td>
    </tr>`;
          }

          tbody.innerHTML =
            rowsHtml ||
            '<tr><td colspan="6" class="text-center p-4 text-muted">Không tìm thấy đơn vị phù hợp với bộ lọc.</td></tr>';
        }
        /**
         * Xuất dữ liệu từ 3 bảng thống kê ra 1 file Excel đa sheet
         */
        function exportAnalyticsToExcel() {
          showToast('info', 'Đang khởi tạo file Excel...');

          // 1. Lấy thông tin giai đoạn để đặt tên file cho chuẩn
          const periodText =
            document.getElementById('table-period')?.innerText ||
            'Bao_cao_giam_sat';
          const fileName = `${periodText.replace(/[:\/]/g, '-')}.xlsx`;

          try {
            // 2. Tạo một Workbook mới (Sách bài tập Excel)
            const wb = XLSX.utils.book_new();

            // 3. Chuyển đổi bảng "Tổng hợp"
            const table1 = document.getElementById('table-analytic-tonghop');
            if (table1) {
              const ws1 = XLSX.utils.table_to_sheet(table1);
              XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp');
            }

            // 4. Chuyển đổi bảng "Chỉ tiêu chi tiết"
            const table2 = document.getElementById('table-analytic-chitieu');
            if (table2) {
              const ws2 = XLSX.utils.table_to_sheet(table2);
              XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết');
            }

            // 5. Chuyển đổi bảng "Cảnh báo"
            const table3 = document.getElementById('table-analytic-canhbao');
            if (table3) {
              const ws3 = XLSX.utils.table_to_sheet(table3);
              XLSX.utils.book_append_sheet(wb, ws3, 'Cảnh báo');
            }
            const table4 = document.getElementById('table-analytic-tiendo');
            if (table4) {
              const ws4 = XLSX.utils.table_to_sheet(table4);
              XLSX.utils.book_append_sheet(wb, ws4, 'Tiến độ');
            }
            // 6. Xuất file và tải xuống
            XLSX.writeFile(wb, fileName);

            showToast('success', 'Xuất file Excel thành công!');
          } catch (err) {
            console.error('Lỗi xuất Excel:', err);
            showToast('error', 'Không thể xuất file Excel.');
          }
        }

        async function handleLogin(event) {
          event.preventDefault();

          // Lấy thông tin từ các ID đã đặt trong HTML của bạn
          const email = document.getElementById('login-email').value;
          const password = document.getElementById('login-password').value;

          showToast('info', 'Đang kiểm tra quyền truy cập...');

          try {
            // 1. Xác thực tài khoản qua Supabase Auth
            const {
              data: { user },
              error: authError,
            } = await supabaseClient.auth.signInWithPassword({
              email: email,
              password: password,
            });

            if (authError) throw authError;

            // 2. Lấy thông tin vai trò từ bảng profiles dựa trên UUID
            const { data: profile, error: profileError } = await supabaseClient
              .from('profiles')
              .select('role, full_name') // Lấy cột role và full_name
              .eq('id', user.id)
              .single();

            if (profileError || !profile) {
              // Trường hợp tài khoản có trong Auth nhưng bạn quên chưa thêm vào bảng profiles
              await supabaseClient.auth.signOut();
              throw new Error(
                'Tài khoản chưa được phân quyền. Vui lòng liên hệ Admin.'
              );
            }

            // 3. Authority: Lưu vai trò vào biến toàn cục và điều hướng
            window.userRole = profile.role;
            showToast('success', `Chào mừng ${profile.full_name || email}!`);

            // Ẩn trang Login và hiển thị WebGIS
            document.getElementById('login-overlay').style.display = 'none';

            // Khởi tạo các module dựa trên quyền
            applyPermissions(profile.role);
            init();
          } catch (error) {
            console.error('Authority Error:', error.message);
            showToast('error', error.message);
          }
        }

        /**
         * Hàm ẩn/hiện chức năng dựa trên quyền hạn (Authority)
         */
        function applyPermissions(role) {
          const sidebar = document.querySelector('.sidebar');
          if (sidebar) {
            const changePwBtn = document.createElement('a');
            changePwBtn.href = '#';
            changePwBtn.className = 'sidebar-item';
            changePwBtn.innerHTML = '<i class="fas fa-key"></i> Đổi mật khẩu';
            changePwBtn.onclick = function (e) {
              e.preventDefault();
              openChangePasswordPage();
            };
            sidebar.appendChild(changePwBtn);
          }
          if (role === 'admin') {
            console.log('Quyền Admin: Mở toàn bộ tính năng.');
            // Hiện các nút quản trị, xóa dữ liệu, v.v.
          } else {
            console.log('Quyền User: Hạn chế một số module.');
            // Ẩn các nút nhạy cảm
            const adminElements = document.querySelectorAll('.admin-only');
            adminElements.forEach((el) => el.remove());
          }
        }

        // ================================================================
        // MODULE 1 — KAMET: Phân tích ý kiến chuyên gia (Delphi)
        // ----------------------------------------------------------------
        // Toàn bộ số liệu (Mdqi/Mqi/Qqi/Vqi) tính 100% từ dữ liệu thô của
        // bảng delphi_responses (phương diện "can_thiet"), KHÔNG hard-code
        // danh sách hay ngưỡng tiêu chí. Chỉ ADMIN mới xem/duyệt được vì
        // dữ liệu delphi_responses có thể định danh chuyên gia (RLS chặn
        // vai trò khác đọc bảng này).
        // Quy tắc chốt trang_thai:
        //   - Mqi < 3.5                                  -> 'loai'
        //   - Mqi >= 3.5 & Qqi <= 0.5 & Vqi(%) < 15       -> 'giu_lai'
        //   - Còn lại (kể cả khi chưa đủ dữ liệu vòng 2)  -> 'vong_sau'
        // ================================================================
        let kametAnalysisResult = []; // Cache kết quả tính toán gần nhất (chưa commit)

        /**
         * Hàm thống kê: percentile kiểu nội suy tuyến tính (giống Excel
         * PERCENTILE.INC / numpy mặc định 'linear'). p trong khoảng [0,1].
         */
        function percentileLinear(sortedArr, p) {
          const n = sortedArr.length;
          if (n === 0) return null;
          if (n === 1) return sortedArr[0];
          const idx = p * (n - 1);
          const lo = Math.floor(idx);
          const hi = Math.ceil(idx);
          if (lo === hi) return sortedArr[lo];
          const frac = idx - lo;
          return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * frac;
        }

        function meanOf(arr) {
          if (!arr.length) return null;
          return arr.reduce((s, v) => s + v, 0) / arr.length;
        }

        /**
         * Tính Mdqi/Mqi/Qqi/Vqi cho TỪNG tiêu chí trong delphi_criteria,
         * dựa trên toàn bộ delphi_responses hiện có.
         * @returns {Array} danh sách kết quả phân tích, mỗi phần tử gồm:
         *   ma_tieu_chi, ten_tieu_chi, nhom, vong_dùng, n_chuyen_gia,
         *   mdqi, mqi, qqi, vqi (số hoặc null nếu không đủ dữ liệu),
         *   de_xuat (giu_lai/loai/vong_sau), trang_thai_hien_tai
         */
        function computeKametStats(criteriaList, responsesList) {
          // Gom nhóm responses theo ma_tieu_chi
          const byCriteria = {};
          responsesList.forEach((r) => {
            if (!byCriteria[r.ma_tieu_chi]) byCriteria[r.ma_tieu_chi] = [];
            byCriteria[r.ma_tieu_chi].push(r);
          });

          return criteriaList.map((crit) => {
            const rows = byCriteria[crit.ma_tieu_chi] || [];
            const validRows = rows.filter(
              (r) => r.can_thiet !== null && r.can_thiet !== undefined
            );

            if (validRows.length === 0) {
              return {
                ma_tieu_chi: crit.ma_tieu_chi,
                ten_tieu_chi: crit.ten_tieu_chi,
                nhom: crit.nhom,
                vong_dung: null,
                n_chuyen_gia: 0,
                mdqi: null,
                mqi: null,
                qqi: null,
                vqi: null,
                de_xuat: 'vong_sau',
                trang_thai_hien_tai: crit.trang_thai,
                canh_bao: 'Chưa có dữ liệu Delphi cho tiêu chí này',
              };
            }

            // Vòng dùng để tính Mdqi/Mqi/Qqi = vòng đánh giá MỚI NHẤT hiện có
            const maxVong = Math.max(...validRows.map((r) => r.vong));
            const latestRows = validRows.filter((r) => r.vong === maxVong);
            const scores = latestRows
              .map((r) => r.can_thiet)
              .sort((a, b) => a - b);

            const mdqi = percentileLinear(scores, 0.5);
            const mqi = meanOf(scores);
            const q1 = percentileLinear(scores, 0.25);
            const q3 = percentileLinear(scores, 0.75);
            const qqi = q1 !== null && q3 !== null ? (q3 - q1) / 2 : null;

            // Vqi: % chuyên gia đổi điểm can_thiet giữa vòng 1 <-> vòng 2,
            // ghép theo ma_chuyen_gia (chỉ tính được nếu có đủ 2 vòng)
            let vqi = null;
            const v1Map = {};
            const v2Map = {};
            validRows.forEach((r) => {
              if (r.vong === 1) v1Map[r.ma_chuyen_gia] = r.can_thiet;
              if (r.vong === 2) v2Map[r.ma_chuyen_gia] = r.can_thiet;
            });
            const pairedExperts = Object.keys(v1Map).filter(
              (cg) => cg in v2Map
            );
            if (pairedExperts.length > 0) {
              const changed = pairedExperts.filter(
                (cg) => v1Map[cg] !== v2Map[cg]
              ).length;
              vqi = (changed / pairedExperts.length) * 100;
            }

            // --- QUY TẮC CHỐT (đúng thứ tự ưu tiên theo đề bài) ---
            let de_xuat = 'vong_sau';
            let canh_bao = null;
            if (mqi !== null && mqi < 3.5) {
              de_xuat = 'loai';
            } else if (
              mqi !== null &&
              mqi >= 3.5 &&
              qqi !== null &&
              qqi <= 0.5 &&
              vqi !== null &&
              vqi < 15
            ) {
              de_xuat = 'giu_lai';
            } else {
              de_xuat = 'vong_sau';
              if (vqi === null) {
                canh_bao = 'Chưa đủ dữ liệu vòng 2 để tính Vqi';
              }
            }

            return {
              ma_tieu_chi: crit.ma_tieu_chi,
              ten_tieu_chi: crit.ten_tieu_chi,
              nhom: crit.nhom,
              vong_dung: maxVong,
              n_chuyen_gia: latestRows.length,
              mdqi,
              mqi,
              qqi,
              vqi,
              de_xuat,
              trang_thai_hien_tai: crit.trang_thai,
              canh_bao,
            };
          });
        }

        function kametBadge(status) {
          const map = {
            giu_lai: '<span class="badge bg-success">GIỮ LẠI</span>',
            loai: '<span class="badge bg-danger">LOẠI</span>',
            vong_sau: '<span class="badge bg-warning text-dark">VÒNG SAU</span>',
            ung_vien: '<span class="badge bg-secondary">ỨNG VIÊN</span>',
          };
          return (
            map[status] ||
            `<span class="badge bg-secondary">${status || '—'}</span>`
          );
        }

        function fmtNum(v, digits = 2) {
          return v === null || v === undefined || isNaN(v)
            ? '—'
            : Number(v).toFixed(digits);
        }

        /**
         * Nạp dữ liệu delphi_criteria + delphi_responses từ Supabase,
         * tính toán KAMET và render bảng để Admin xem/duyệt.
         * KHÔNG ghi gì vào DB ở bước này (chỉ tính toán phía client).
         */
        async function loadKametAnalysis() {
          const tableEl = document.getElementById('kamet-table');
          const summaryBar = document.getElementById('kamet-summary-bar');
          if (!tableEl) return;
          tableEl.innerHTML =
            '<tbody><tr><td class="p-3">⏳ Đang tải dữ liệu Delphi...</td></tr></tbody>';

          try {
            const [
              { data: criteria, error: errCrit },
              { data: responses, error: errResp },
            ] = await Promise.all([
              supabaseClient
                .from('delphi_criteria')
                .select('*')
                .order('thu_tu', { ascending: true }),
              supabaseClient
                .from('delphi_responses')
                .select('ma_chuyen_gia, ma_tieu_chi, nhom, vong, can_thiet'),
            ]);

            if (errCrit) throw errCrit;
            if (errResp) throw errResp;

            kametAnalysisResult = computeKametStats(
              criteria || [],
              responses || []
            );

            renderKametSummary(kametAnalysisResult, (responses || []).length);
            renderKametTable(kametAnalysisResult);
          } catch (err) {
            console.error('❌ Lỗi tải phân tích KAMET:', err);
            tableEl.innerHTML = `<tbody><tr><td class="p-3 text-danger">Lỗi: ${err.message}</td></tr></tbody>`;
            showToast('error', 'Không thể tải dữ liệu Delphi: ' + err.message);
          }
        }

        function renderKametSummary(results, nResponses) {
          const summaryBar = document.getElementById('kamet-summary-bar');
          if (!summaryBar) return;
          const counts = { giu_lai: 0, loai: 0, vong_sau: 0 };
          results.forEach((r) => counts[r.de_xuat]++);
          summaryBar.innerHTML = `
            <span class="kamet-summary-chip kamet-chip-giu">✅ Đề xuất GIỮ: ${counts.giu_lai}</span>
            <span class="kamet-summary-chip kamet-chip-loai">❌ Đề xuất LOẠI: ${counts.loai}</span>
            <span class="kamet-summary-chip kamet-chip-vongsau">🔄 Đề xuất VÒNG SAU: ${counts.vong_sau}</span>
            <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
              Tổng ${results.length} tiêu chí · ${nResponses} lượt trả lời
            </span>`;
        }

        function renderKametTable(results) {
          const tableEl = document.getElementById('kamet-table');
          if (!tableEl) return;
          const groupLabel = {
            KN: 'Khả năng',
            HQ: 'Hiệu quả',
            DBP: 'DBP (Điểm mù/mật độ)',
          };
          const head = `
            <thead class="table-dark sticky-top">
              <tr>
                <th>Mã</th><th>Tên tiêu chí</th><th>Nhóm</th>
                <th>Vòng dùng</th><th>N.CG</th><th>Mdqi</th>
                <th>Mqi</th><th>Qqi</th><th>Vqi (%)</th>
                <th>Đề xuất (mới)</th><th>Trạng thái hiện tại</th>
              </tr>
            </thead>`;

          const sorted = [...results].sort((a, b) => {
            if (a.nhom !== b.nhom) return a.nhom.localeCompare(b.nhom);
            return a.ma_tieu_chi.localeCompare(b.ma_tieu_chi);
          });

          const rowsHtml = sorted
            .map((r) => {
              const isDiff = r.de_xuat !== r.trang_thai_hien_tai;
              const warn = r.canh_bao
                ? `<br><small class="kamet-diff-flag"><i class="fa-solid fa-triangle-exclamation"></i> ${r.canh_bao}</small>`
                : '';
              return `
              <tr>
                <td><b>${r.ma_tieu_chi}</b></td>
                <td>${r.ten_tieu_chi}${warn}</td>
                <td>${groupLabel[r.nhom] || r.nhom}</td>
                <td>${r.vong_dung ?? '—'}</td>
                <td>${r.n_chuyen_gia}</td>
                <td>${fmtNum(r.mdqi)}</td>
                <td>${fmtNum(r.mqi)}</td>
                <td>${fmtNum(r.qqi)}</td>
                <td>${r.vqi === null ? '—' : fmtNum(r.vqi, 1) + '%'}</td>
                <td>${kametBadge(r.de_xuat)}${
                isDiff ? ' <span class="kamet-diff-flag">●</span>' : ''
              }</td>
                <td>${kametBadge(r.trang_thai_hien_tai)}</td>
              </tr>`;
            })
            .join('');

          tableEl.innerHTML = head + `<tbody>${rowsHtml}</tbody>`;
        }

        function openKametModal() {
          const modal = document.getElementById('modal-kamet');
          if (!modal) return;
          modal.style.display = 'block';
          loadKametAnalysis();
        }

        function closeKametModal() {
          const modal = document.getElementById('modal-kamet');
          if (modal) modal.style.display = 'none';
        }

        /**
         * CHỐT KẾT QUẢ: Ghi trang_thai (+ mqi/mdqi/qqi/vqi) đã tính vào
         * bảng delphi_criteria. Yêu cầu Admin xác nhận trước (theo đề bài:
         * "Cho người dùng xem/duyệt trước khi chốt"). RLS phía Supabase
         * chỉ cho phép role='admin' UPDATE bảng này.
         */
        async function commitKametResults() {
          if (!kametAnalysisResult || kametAnalysisResult.length === 0) {
            return showToast(
              'warning',
              'Chưa có dữ liệu phân tích để chốt. Hãy bấm "Tính lại" trước.'
            );
          }

          const counts = { giu_lai: 0, loai: 0, vong_sau: 0 };
          kametAnalysisResult.forEach((r) => counts[r.de_xuat]++);

          const confirmResult = await Swal.fire({
            icon: 'question',
            title: 'Xác nhận CHỐT kết quả KAMET?',
            html: `Sẽ cập nhật <b>trang_thai</b> (và Mdqi/Mqi/Qqi/Vqi) cho ${kametAnalysisResult.length} tiêu chí vào bảng <code>delphi_criteria</code>:<br><br>
                   ✅ Giữ lại: <b>${counts.giu_lai}</b> &nbsp;|&nbsp;
                   ❌ Loại: <b>${counts.loai}</b> &nbsp;|&nbsp;
                   🔄 Vòng sau: <b>${counts.vong_sau}</b><br><br>
                   <small style="color:#c0392b">Hành động này sẽ ghi đè trạng thái hiện tại.</small>`,
            showCancelButton: true,
            confirmButtonText: 'Xác nhận CHỐT',
            cancelButtonText: 'Hủy bỏ',
            confirmButtonColor: '#f26522',
          });

          if (!confirmResult.isConfirmed) return;

          const btn = document.getElementById('btn-kamet-commit');
          if (btn) {
            btn.disabled = true;
            btn.innerHTML =
              '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG LƯU...';
          }

          try {
            const updates = kametAnalysisResult.map((r) =>
              supabaseClient
                .from('delphi_criteria')
                .update({
                  trang_thai: r.de_xuat,
                  mdqi: r.mdqi,
                  mqi: r.mqi,
                  qqi: r.qqi,
                  vqi: r.vqi,
                })
                .eq('ma_tieu_chi', r.ma_tieu_chi)
            );

            const results = await Promise.all(updates);
            const failed = results.filter((res) => res.error);

            if (failed.length > 0) {
              console.error('Lỗi khi chốt một số tiêu chí:', failed);
              showToast(
                'error',
                `Có ${failed.length} tiêu chí lưu thất bại (kiểm tra quyền Admin / RLS).`
              );
            } else {
              showToast(
                'success',
                `Đã chốt trạng thái cho ${kametAnalysisResult.length} tiêu chí!`
              );
            }

            await loadKametAnalysis(); // Tải lại để phản ánh trạng thái mới
          } catch (err) {
            console.error('❌ Lỗi chốt KAMET:', err);
            showToast('error', 'Lỗi khi chốt kết quả: ' + err.message);
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML =
                '<i class="fa-solid fa-check-double"></i> CHỐT KẾT QUẢ VÀO delphi_criteria';
            }
          }
        }

        // ================================================================
        // MODULE 2 — Tổng hợp trọng số AHP (nhiều chuyên gia) — chỉ Admin
        // ----------------------------------------------------------------
        // Toàn bộ dùng chung ahp-core.js (đã kiểm định qua test/ahp_test.js)
        // để KHÔNG viết lại công thức AHP ở nơi khác.
        // ================================================================
        let ahpAggregateResult = null; // cache kết quả tính lần gần nhất (chưa lưu)

        async function loadAhpAggregate() {
          const tableEl = document.getElementById('ahp-agg-table');
          const summaryBar = document.getElementById('ahp-agg-summary-bar');
          if (!tableEl) return;
          tableEl.innerHTML =
            '<tbody><tr><td class="p-3">⏳ Đang tải dữ liệu AHP...</td></tr></tbody>';

          try {
            const [
              { data: criteria, error: errCrit },
              { data: submissions, error: errSub },
            ] = await Promise.all([
              supabaseClient
                .from('delphi_criteria')
                .select('ma_tieu_chi, ten_tieu_chi, nhom, thu_tu')
                .eq('trang_thai', 'giu_lai')
                .order('thu_tu', { ascending: true }),
              supabaseClient
                .from('ahp_submissions')
                .select('ma_chuyen_gia, ma_tran_key, items, matrix'),
            ]);

            if (errCrit) throw errCrit;
            if (errSub) throw errSub;

            if (!criteria || criteria.length === 0) {
              tableEl.innerHTML =
                '<tbody><tr><td class="p-3 text-warning">Chưa có tiêu chí nào ở trạng thái "giu_lai". Hãy hoàn tất Module 1 (KAMET) trước.</td></tr></tbody>';
              summaryBar.innerHTML = '';
              ahpAggregateResult = null;
              return;
            }

            const hierarchy = AHPCore.buildAhpHierarchy(criteria);
            ahpAggregateResult = computeAhpAggregation(
              hierarchy,
              submissions || []
            );

            renderAhpAggSummary(ahpAggregateResult, submissions || []);
            renderAhpAggTable(ahpAggregateResult);
          } catch (err) {
            console.error('❌ Lỗi tải tổng hợp AHP:', err);
            tableEl.innerHTML = `<tbody><tr><td class="p-3 text-danger">Lỗi: ${err.message}</td></tr></tbody>`;
            showToast('error', 'Không thể tải dữ liệu AHP: ' + err.message);
          }
        }

        /**
         * Gộp nhiều chuyên gia -> trọng số toàn cục, hoàn toàn data-driven
         * theo hierarchy động (KHÔNG hard-code số lượng nhóm/tiêu chí).
         * Với mỗi ma trận cần thiết (GROUP + từng nhóm có >=2 tiêu chí):
         *   1. Lấy tất cả submissions khớp ma_tran_key, gộp ma trận bằng
         *      trung bình nhân (AHPCore.aggregateMatricesGeometric).
         *   2. Tính lại trọng số + CR TỔNG HỢP bằng AHPCore.computeWeights.
         * Ca đặc biệt (1 nhóm / 1 tiêu chí trong nhóm) không cần submission
         * nào, trọng số tự động = 1 (xử lý trong AHPCore.computeGlobalWeights).
         */
        function computeAhpAggregation(hierarchy, submissions) {
          const byKey = {};
          submissions.forEach((s) => {
            if (!byKey[s.ma_tran_key]) byKey[s.ma_tran_key] = [];
            byKey[s.ma_tran_key].push(s);
          });

          const matrixResults = {};
          const warnings = [];

          function aggregateOne(key, expectedItems) {
            const subs = byKey[key] || [];
            if (subs.length === 0) {
              warnings.push(`Chưa có chuyên gia nào nộp ma trận "${key}".`);
              return null;
            }
            const orderMaCode = expectedItems.map((it) => it.ma_tieu_chi);
            const matrices = [];
            subs.forEach((s) => {
              const subOrder = (s.items || []).map((it) => it.ma_tieu_chi);
              const sameSet =
                subOrder.length === orderMaCode.length &&
                orderMaCode.every((code) => subOrder.includes(code));
              if (!sameSet) return;

              const idxMap = subOrder.map((code) => orderMaCode.indexOf(code));
              const n = orderMaCode.length;
              const reordered = [];
              for (let i = 0; i < n; i++) {
                const row = [];
                for (let j = 0; j < n; j++) {
                  const srcI = idxMap.indexOf(i);
                  const srcJ = idxMap.indexOf(j);
                  row.push(s.matrix[srcI][srcJ]);
                }
                reordered.push(row);
              }
              matrices.push(reordered);
            });

            if (matrices.length === 0) {
              warnings.push(
                `Các bản nộp cho ma trận "${key}" không khớp bộ tiêu chí hiện tại.`
              );
              return null;
            }

            const aggMatrix = AHPCore.aggregateMatricesGeometric(matrices);
            const result = AHPCore.computeWeights(aggMatrix);
            return {
              nExperts: matrices.length,
              matrix: aggMatrix,
              weights: result.weights,
              lambdaMax: result.lambdaMax,
              ci: result.ci,
              cr: result.cr,
            };
          }

          let groupWeights = {};
          if (hierarchy.needsGroupMatrix) {
            const groupItems = hierarchy.groups.map((g) => ({ ma_tieu_chi: g }));
            const r = aggregateOne('GROUP', groupItems);
            if (r) {
              matrixResults['GROUP'] = r;
              hierarchy.groups.forEach((g, idx) => (groupWeights[g] = r.weights[idx]));
            }
          } else if (hierarchy.groups.length === 1) {
            groupWeights[hierarchy.groups[0]] = 1;
          }

          const localWeightsByGroup = {};
          hierarchy.groups.forEach((g) => {
            if (hierarchy.needsLocalMatrix[g]) {
              const r = aggregateOne(g, hierarchy.itemsByGroup[g]);
              if (r) {
                matrixResults[g] = r;
                localWeightsByGroup[g] = r.weights;
              }
            }
          });

          const globalWeights = AHPCore.computeGlobalWeights(
            hierarchy,
            groupWeights,
            localWeightsByGroup
          );

          const sumGlobal = globalWeights.reduce((s, r) => s + r.w_toan_cuc, 0);

          return { hierarchy, matrixResults, globalWeights, sumGlobal, warnings };
        }

        function renderAhpAggSummary(agg, submissions) {
          const bar = document.getElementById('ahp-agg-summary-bar');
          if (!bar) return;
          const experts = new Set(submissions.map((s) => s.ma_chuyen_gia));
          const sumOk = Math.abs(agg.sumGlobal - 1) < 0.001;
          let html = `
            <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
              ${experts.size} chuyên gia · ${submissions.length} lượt nộp
            </span>
            <span class="kamet-summary-chip ${sumOk ? 'kamet-chip-giu' : 'kamet-chip-loai'}">
              Tổng trọng số toàn cục = ${agg.sumGlobal.toFixed(4)} ${
            sumOk ? '✅' : '❌ (sai lệch >0.001)'
          }
            </span>`;
          agg.warnings.forEach((w) => {
            html += `<span class="kamet-summary-chip kamet-chip-vongsau"><i class="fa-solid fa-triangle-exclamation"></i> ${w}</span>`;
          });
          bar.innerHTML = html;
        }

        function renderAhpAggTable(agg) {
          const tableEl = document.getElementById('ahp-agg-table');
          if (!tableEl) return;

          let matrixRows = Object.keys(agg.matrixResults)
            .map((key) => {
              const r = agg.matrixResults[key];
              const crOk = r.cr <= 0.1;
              return `<tr>
                <td><b>${key}</b></td>
                <td>${r.nExperts}</td>
                <td>${r.lambdaMax.toFixed(3)}</td>
                <td>${r.ci.toFixed(4)}</td>
                <td class="${crOk ? '' : 'kamet-diff-flag'}">${r.cr.toFixed(4)} ${
                crOk ? '✅' : '❌'
              }</td>
              </tr>`;
            })
            .join('');

          const groupLabel = { KN: 'Khả năng', HQ: 'Hiệu quả', DBP: 'DBP' };
          let globalRows = [...agg.globalWeights]
            .sort((a, b) => b.w_toan_cuc - a.w_toan_cuc)
            .map(
              (r) => `<tr>
                <td><b>${r.ma_tieu_chi}</b></td>
                <td>${groupLabel[r.nhom] || r.nhom}</td>
                <td>${r.w_nhom.toFixed(4)}</td>
                <td>${r.w_cuc_bo.toFixed(4)}</td>
                <td><b>${r.w_toan_cuc.toFixed(4)}</b></td>
              </tr>`
            )
            .join('');

          tableEl.innerHTML = `
            <thead class="table-dark">
              <tr><th colspan="5">CR tổng hợp theo từng ma trận (sau khi gộp chuyên gia)</th></tr>
              <tr><th>Ma trận</th><th>Số CG</th><th>λmax</th><th>CI</th><th>CR</th></tr>
            </thead>
            <tbody>${
              matrixRows || '<tr><td colspan="5" class="text-muted">Chưa có dữ liệu</td></tr>'
            }</tbody>
            <thead class="table-dark">
              <tr><th colspan="5">Trọng số toàn cục (w_nhom × w_cục_bộ)</th></tr>
              <tr><th>Mã</th><th>Nhóm</th><th>w_nhóm</th><th>w_cục_bộ</th><th>w_toàn_cục</th></tr>
            </thead>
            <tbody>${
              globalRows || '<tr><td colspan="5" class="text-muted">Chưa có dữ liệu</td></tr>'
            }</tbody>
          `;
        }

        function openAhpAggregateModal() {
          const modal = document.getElementById('modal-ahp-aggregate');
          if (!modal) return;
          modal.style.display = 'block';
          loadAhpAggregate();
        }

        function closeAhpAggregateModal() {
          const modal = document.getElementById('modal-ahp-aggregate');
          if (modal) modal.style.display = 'none';
        }

        /**
         * Lưu trọng số toàn cục đã tính vào bảng criteria_weights (upsert
         * theo PK ma_tieu_chi) — đầu vào cho Module 3 (chấm điểm).
         */
        async function saveCriteriaWeights() {
          if (!ahpAggregateResult || !ahpAggregateResult.globalWeights.length) {
            return showToast(
              'warning',
              'Chưa có kết quả tổng hợp để lưu. Hãy bấm "Tính lại" trước.'
            );
          }

          if (Math.abs(ahpAggregateResult.sumGlobal - 1) >= 0.001) {
            return showToast(
              'error',
              `Tổng trọng số toàn cục = ${ahpAggregateResult.sumGlobal.toFixed(
                4
              )} (lệch quá 0.001). Không lưu để tránh sai số lan sang Module 3.`
            );
          }

          const confirmResult = await Swal.fire({
            icon: 'question',
            title: 'Lưu trọng số toàn cục?',
            html: `Sẽ ghi đè <b>${ahpAggregateResult.globalWeights.length}</b> dòng vào bảng <code>criteria_weights</code>, dùng làm đầu vào chấm điểm Module 3.`,
            showCancelButton: true,
            confirmButtonText: 'Xác nhận LƯU',
            cancelButtonText: 'Hủy bỏ',
            confirmButtonColor: '#f26522',
          });
          if (!confirmResult.isConfirmed) return;

          const btn = document.getElementById('btn-ahp-agg-save');
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG LƯU...';
          }

          try {
            const rows = ahpAggregateResult.globalWeights.map((r) => ({
              ma_tieu_chi: r.ma_tieu_chi,
              nhom: r.nhom,
              w_nhom: r.w_nhom,
              w_cuc_bo: r.w_cuc_bo,
              w_toan_cuc: r.w_toan_cuc,
              updated_at: new Date().toISOString(),
            }));

            const { error } = await supabaseClient
              .from('criteria_weights')
              .upsert(rows, { onConflict: 'ma_tieu_chi' });

            if (error) throw error;

            showToast(
              'success',
              `Đã lưu trọng số toàn cục cho ${rows.length} tiêu chí!`
            );
          } catch (err) {
            console.error('❌ Lỗi lưu criteria_weights:', err);
            showToast('error', 'Lỗi khi lưu trọng số: ' + err.message);
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML =
                '<i class="fa-solid fa-floppy-disk"></i> LƯU TRỌNG SỐ TOÀN CỤC';
            }
          }
        }

        // ================================================================
        // MODULE 3 — Gộp mẫu → điểm & Chấm điểm nguy cơ — chỉ Admin
        // ----------------------------------------------------------------
        // Dùng chung scoring-core.js (đã kiểm định qua test/scoring_test.js)
        // để KHÔNG viết lại công thức gộp/chuẩn hóa/chấm điểm ở nơi khác.
        // ================================================================
        let lastScoringRunResult = null; // cache kết quả lần chấm điểm gần nhất
        let riskMapLeaflet = null; // instance Leaflet của modal bản đồ ưu tiên

        // ----------------------------------------------------------------
        // HELPER DÙNG CHUNG: PostgREST/Supabase mặc định GIỚI HẠN 1000 dòng
        // mỗi truy vấn .select(). Mọi nơi cần LẤY TOÀN BỘ hàng của 1 bảng
        // (monitoring_points ~1.219, water_reports ~2.515, ...) BẮT BUỘC
        // phải phân trang bằng fetchAllRows() thay vì .select() trần trụi,
        // nếu không dữ liệu sẽ bị CẮT ÂM THẦM còn đúng 1000 dòng (không
        // báo lỗi) dẫn tới số liệu sai lệch nghiêm trọng ở mọi nơi dùng nó
        // (chấm điểm R, kiểm chứng thống kê, Tab 1...).
        // ----------------------------------------------------------------
        async function fetchAllRows(tableName, selectStr, applyFilters) {
          let allRows = [];
          let from = 0;
          const pageSize = 1000;
          let hasMore = true;
          while (hasMore) {
            let query = supabaseClient.from(tableName).select(selectStr);
            if (typeof applyFilters === 'function') query = applyFilters(query);
            const { data, error } = await query.range(from, from + pageSize - 1);
            if (error) throw error;
            allRows = allRows.concat(data || []);
            hasMore = (data || []).length === pageSize;
            from += pageSize;
          }
          return allRows;
        }

        /**
         * Đếm số dòng CHÍNH XÁC phía server (không tải dữ liệu về client),
         * dùng count:'exact', head:true để tránh giới hạn 1000 dòng và
         * tránh tải dữ liệu thừa chỉ để đếm .length.
         */
        async function countRows(tableName, applyFilters) {
          let query = supabaseClient
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          if (typeof applyFilters === 'function') query = applyFilters(query);
          const { count, error } = await query;
          if (error) throw error;
          return count || 0;
        }

        function openScoringModal() {
          const modal = document.getElementById('modal-scoring');
          if (!modal) return;
          modal.style.display = 'block';
          document.getElementById('scoring-progress').innerHTML = '';
          document.getElementById('scoring-summary-bar').innerHTML = '';
          document.getElementById('scoring-table').innerHTML = '';
        }

        function closeScoringModal() {
          const modal = document.getElementById('modal-scoring');
          if (modal) modal.style.display = 'none';
        }

        function setScoringProgress(html) {
          const el = document.getElementById('scoring-progress');
          if (el) el.innerHTML = html;
        }

        /**
         * BƯỚC 1 (3.1): Gộp water_reports (2025, approved, lat/lng hợp lệ)
         * thành danh sách điểm duy nhất, upsert vào monitoring_points.
         * Đây là phần dữ liệu ĐÃ CÓ THẬT (2.515 mẫu) nên chạy trực tiếp.
         */
        async function runAggregateSamplesToPoints() {
          const btn = document.getElementById('btn-run-aggregate-points');
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG GỘP...';
          }
          setScoringProgress('⏳ Đang tải mẫu nước 2025 đã duyệt từ water_reports...');

          try {
            // Tải toàn bộ mẫu hợp lệ theo trang (tránh giới hạn 1000 dòng mặc định)
            let allSamples = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;
            while (hasMore) {
              const { data, error } = await supabaseClient
                .from('water_reports')
                .select('lat, lng, hl_vs, maphuong_temp, sampling_date, status')
                .gte('sampling_date', '2025-01-01')
                .lte('sampling_date', '2025-12-31')
                .eq('status', 'approved')
                .not('lat', 'is', null)
                .not('lng', 'is', null)
                .range(from, from + pageSize - 1);

              if (error) throw error;
              allSamples = allSamples.concat(data || []);
              hasMore = (data || []).length === pageSize;
              from += pageSize;
            }

            setScoringProgress(
              `⏳ Đã tải ${allSamples.length} mẫu. Đang gộp theo tọa độ (làm tròn 5 chữ số)...`
            );

            // 'K' = Không đạt (theo cột hl_vs thực tế của water_reports)
            const points = ScoringCore.aggregateSamplesToPoints(allSamples, 'K');

            setScoringProgress(
              `⏳ Đã gộp thành ${points.length} điểm. Đang lưu vào monitoring_points...`
            );

            // Upsert theo lô để tránh payload quá lớn
            const CHUNK = 500;
            for (let i = 0; i < points.length; i += CHUNK) {
              const chunk = points.slice(i, i + CHUNK).map((p) => ({
                point_code: p.point_code,
                lat: p.lat,
                lng: p.lng,
                khu_vuc: p.khu_vuc,
                n_mau: p.n_mau,
                khong_dat: p.khong_dat,
                ty_le_khong_dat: p.ty_le_khong_dat,
                updated_at: new Date().toISOString(),
              }));
              const { error: upsertErr } = await supabaseClient
                .from('monitoring_points')
                .upsert(chunk, { onConflict: 'point_code' });
              if (upsertErr) throw upsertErr;
            }

            const nKhongDat = points.filter((p) => p.khong_dat === 1).length;
            setScoringProgress(
              `✅ Hoàn tất Bước 1: <b>${points.length}</b> điểm giám sát (từ ${allSamples.length} mẫu), trong đó <b>${nKhongDat}</b> điểm có ≥1 mẫu không đạt (${((nKhongDat / points.length) * 100).toFixed(1)}%).`
            );
            showToast('success', `Đã gộp ${allSamples.length} mẫu thành ${points.length} điểm giám sát!`);
          } catch (err) {
            console.error('❌ Lỗi gộp mẫu -> điểm:', err);
            setScoringProgress(`❌ Lỗi: ${err.message}`);
            showToast('error', 'Lỗi khi gộp mẫu thành điểm: ' + err.message);
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> BƯỚC 1: GỘP MẪU → ĐIỂM';
            }
          }
        }

        /**
         * Hàm băm chuỗi đơn giản (FNV-1a 32-bit) dùng để tạo checksum dữ
         * liệu cho analysis_runs (bằng chứng tái lập), không cần thư viện
         * ngoài. Đủ tốt để phát hiện thay đổi dữ liệu giữa các lần chạy.
         */
        function fnv1aHash(str) {
          let hash = 0x811c9dc5;
          for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
          }
          return (hash >>> 0).toString(16);
        }

        /**
         * BƯỚC 2 (3.2 + 3.3): Chấm điểm nguy cơ R cho từng điểm trong
         * monitoring_points, dựa trên criteria_weights + point_attributes.
         * CHẠY AN TOÀN khi point_attributes rỗng/thiếu: không crash, chỉ
         * báo "chưa đủ dữ liệu thuộc tính để chấm điểm" và không tính R.
         */
        async function runRiskScoring() {
          const btn = document.getElementById('btn-run-risk-scoring');
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG CHẤM ĐIỂM...';
          }
          setScoringProgress('⏳ Đang tải trọng số toàn cục (criteria_weights)...');

          try {
            const { data: weightRows, error: wErr } = await supabaseClient
              .from('criteria_weights')
              .select('ma_tieu_chi, nhom, w_toan_cuc, updated_at');
            if (wErr) throw wErr;

            if (!weightRows || weightRows.length === 0) {
              setScoringProgress(
                '⚠️ Chưa có trọng số nào trong <code>criteria_weights</code>. Vui lòng hoàn tất Module 2 (Tổng hợp trọng số AHP) trước khi chấm điểm.'
              );
              showToast('warning', 'Chưa có trọng số toàn cục để chấm điểm.');
              return;
            }

            const weightsVersion = weightRows
              .map((r) => r.updated_at)
              .sort()
              .slice(-1)[0]; // dùng mốc updated_at mới nhất làm "phiên bản" trọng số

            setScoringProgress('⏳ Đang tải danh sách điểm giám sát (monitoring_points)...');
            // LƯU Ý: dùng fetchAllRows() (phân trang) để KHÔNG bị PostgREST
            // cắt còn 1000 dòng — monitoring_points hiện có ~1.219 điểm.
            const points = await fetchAllRows(
              'monitoring_points',
              'point_code, lat, lng, khu_vuc, n_mau, khong_dat, ty_le_khong_dat'
            );
            console.log(`📊 [Module 3] Đã tải ${points.length} điểm từ monitoring_points (phân trang, không giới hạn 1000).`);

            if (!points || points.length === 0) {
              setScoringProgress(
                '⚠️ Chưa có điểm giám sát nào. Vui lòng chạy "Bước 1: Gộp mẫu → điểm" trước.'
              );
              showToast('warning', 'Chưa có điểm giám sát để chấm điểm.');
              return;
            }

            setScoringProgress(`⏳ Đang tải thuộc tính điểm (point_attributes) cho ${points.length} điểm...`);
            const pointCodes = points.map((p) => p.point_code);
            let attrRows = [];
            const CHUNK_Q = 300;
            for (let i = 0; i < pointCodes.length; i += CHUNK_Q) {
              const chunkCodes = pointCodes.slice(i, i + CHUNK_Q);
              const { data, error } = await supabaseClient
                .from('point_attributes')
                .select('*')
                .in('point_code', chunkCodes);
              if (error) throw error;
              attrRows = attrRows.concat(data || []);
            }

            if (attrRows.length === 0) {
              setScoringProgress(
                '⚠️ <b>Chưa đủ dữ liệu thuộc tính để chấm điểm</b>: bảng <code>point_attributes</code> hiện chưa có dữ liệu (đang chờ import). Bước "Gộp mẫu → điểm" vẫn đã hoàn tất, nhưng điểm nguy cơ R sẽ được tính sau khi có thuộc tính GIS/hạ tầng.'
              );
              showToast(
                'warning',
                'Chưa có dữ liệu point_attributes — chưa thể chấm điểm R.'
              );
              return;
            }

            runRiskScoringCore(points, attrRows, weightRows, weightsVersion);
          } catch (err) {
            console.error('❌ Lỗi chấm điểm nguy cơ:', err);
            setScoringProgress(`❌ Lỗi: ${err.message}`);
            showToast('error', 'Lỗi khi chấm điểm: ' + err.message);
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<i class="fa-solid fa-calculator"></i> BƯỚC 2: CHẤM ĐIỂM NGUY CƠ';
            }
          }
        }

        /**
         * Lõi tính toán: chuẩn hóa tiêu chí (3.2), tính R + xếp hạng (3.3),
         * lưu kết quả vào monitoring_points, ghi 1 analysis_run bất biến.
         * Tách riêng khỏi runRiskScoring() để test/scoring_test.js có thể
         * tái sử dụng chính xác cùng luồng logic (qua scoring-core.js).
         */
        async function runRiskScoringCore(points, attrRows, weightRows, weightsVersion) {
          setScoringProgress('⏳ Đang chuẩn hóa tiêu chí (min–max/nhị phân/thứ hạng)...');

          const attrByCode = {};
          attrRows.forEach((a) => (attrByCode[a.point_code] = a));

          const criteriaCodes = weightRows.map((w) => w.ma_tieu_chi);
          const normParams = ScoringCore.computeNormalizationParams(
            attrRows,
            criteriaCodes
          );

          setScoringProgress('⏳ Đang tính điểm nguy cơ R cho từng điểm...');

          const scored = points.map((p) => {
            const attr = attrByCode[p.point_code] || null;
            const result = ScoringCore.computeRiskScoreForPoint(
              attr,
              weightRows,
              normParams
            );
            return Object.assign({}, p, {
              R: result.R,
              usedCriteria: result.usedCriteria,
              missingCriteria: result.missingCriteria,
            });
          });

          const ranked = ScoringCore.rankAndGroupByQuartile(scored);
          const withR = ranked.filter((p) => p.R !== null && p.R !== undefined);

          if (withR.length === 0) {
            setScoringProgress(
              '⚠️ <b>Chưa đủ dữ liệu thuộc tính để chấm điểm</b>: không điểm nào có đủ ít nhất 1 tiêu chí khớp dữ liệu trong point_attributes.'
            );
            showToast('warning', 'Không đủ dữ liệu thuộc tính hợp lệ để tính R.');
            return;
          }

          setScoringProgress(`⏳ Đã tính R cho ${withR.length}/${points.length} điểm. Đang lưu kết quả...`);

          // Lưu kết quả vào monitoring_points theo lô
          const CHUNK = 500;
          for (let i = 0; i < ranked.length; i += CHUNK) {
            const chunk = ranked.slice(i, i + CHUNK).map((p) => ({
              point_code: p.point_code,
              lat: p.lat,
              lng: p.lng,
              khu_vuc: p.khu_vuc,
              n_mau: p.n_mau,
              khong_dat: p.khong_dat,
              ty_le_khong_dat: p.ty_le_khong_dat,
              diem_r: p.R,
              xep_hang: p.xep_hang,
              nhom_uu_tien: p.nhom_uu_tien,
              weights_version: weightsVersion,
              updated_at: new Date().toISOString(),
            }));
            const { error } = await supabaseClient
              .from('monitoring_points')
              .upsert(chunk, { onConflict: 'point_code' });
            if (error) throw error;
          }

          // Ghi 1 analysis_run bất biến làm bằng chứng (checksum + N + trọng số dùng)
          const checksumInput = JSON.stringify(
            ranked.map((p) => [p.point_code, p.R]).sort((a, b) => (a[0] > b[0] ? 1 : -1))
          );
          const dataChecksum = fnv1aHash(checksumInput);
          const nKhongDat = ranked.filter((p) => p.khong_dat === 1).length;

          const {
            data: { user },
          } = await supabaseClient.auth.getUser();

          const runPayload = {
            run_time: new Date().toISOString(),
            nguoi_thuc_hien: (user && user.email) || 'admin',
            mo_ta: 'Module 3 - Chấm điểm nguy cơ R theo criteria_weights + point_attributes',
            data_checksum: dataChecksum,
            n_diem: ranked.length,
            n_khong_dat: nKhongDat,
            trong_so: weightRows,
            ket_qua_kiem_dinh: {
              n_diem_co_R: withR.length,
              n_diem_thieu_thuoc_tinh: ranked.length - withR.length,
              min_R: Math.min.apply(null, withR.map((p) => p.R)),
              max_R: Math.max.apply(null, withR.map((p) => p.R)),
              normalization_params: normParams,
              weights_version: weightsVersion,
            },
            phien_ban_thu_vien: { scoring_core: '1.0', ahp_core: '1.0' },
          };

          const { error: runErr } = await supabaseClient
            .from('analysis_runs')
            .insert(runPayload);
          if (runErr) console.warn('⚠️ Không thể ghi analysis_run:', runErr.message);

          lastScoringRunResult = { ranked, normParams, weightRows, weightsVersion, dataChecksum };

          renderScoringSummary(ranked, normParams, weightsVersion);
          renderScoringTable(ranked);

          setScoringProgress(
            `✅ Hoàn tất Bước 2: đã tính R cho <b>${withR.length}/${ranked.length}</b> điểm. Đã lưu vào monitoring_points và ghi 1 analysis_run.`
          );
          showToast('success', `Đã chấm điểm nguy cơ cho ${withR.length} điểm!`);
        }

        function renderScoringSummary(ranked, normParams, weightsVersion) {
          const bar = document.getElementById('scoring-summary-bar');
          if (!bar) return;
          const withR = ranked.filter((p) => p.R !== null && p.R !== undefined);
          const groupCounts = {};
          withR.forEach((p) => (groupCounts[p.nhom_uu_tien] = (groupCounts[p.nhom_uu_tien] || 0) + 1));
          const minR = withR.length ? Math.min.apply(null, withR.map((p) => p.R)) : null;
          const maxR = withR.length ? Math.max.apply(null, withR.map((p) => p.R)) : null;

          let html = `
            <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
              N=${ranked.length} điểm · ${withR.length} có điểm R · weights_version=${
            weightsVersion ? new Date(weightsVersion).toLocaleString('vi-VN') : '—'
          }
            </span>
            <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
              R: min=${minR !== null ? minR.toFixed(4) : '—'} · max=${maxR !== null ? maxR.toFixed(4) : '—'}
            </span>`;
          ['Ưu tiên cao', 'Trung bình-cao', 'Trung bình', 'Thấp'].forEach((g) => {
            const cls =
              g === 'Ưu tiên cao'
                ? 'kamet-chip-loai'
                : g === 'Thấp'
                ? 'kamet-chip-giu'
                : 'kamet-chip-vongsau';
            html += `<span class="kamet-summary-chip ${cls}">${g}: ${groupCounts[g] || 0}</span>`;
          });
          bar.innerHTML = html;
        }

        function renderScoringTable(ranked) {
          const tableEl = document.getElementById('scoring-table');
          if (!tableEl) return;

          const normParamsUsed = lastScoringRunResult ? lastScoringRunResult.normParams : {};
          const normRows = Object.keys(normParamsUsed)
            .map((code) => {
              const p = normParamsUsed[code];
              return `<tr><td>${code}</td><td>${p.min}</td><td>${p.max}</td><td>${p.n}</td></tr>`;
            })
            .join('');

          const sorted = [...ranked]
            .filter((p) => p.R !== null && p.R !== undefined)
            .sort((a, b) => b.R - a.R)
            .slice(0, 100); // hiển thị top 100 để tránh render quá nặng

          const pointRows = sorted
            .map(
              (p) => `<tr>
                <td>${p.xep_hang}</td>
                <td>${p.point_code}</td>
                <td>${p.khu_vuc || '—'}</td>
                <td>${p.n_mau}</td>
                <td>${p.khong_dat === 1 ? '❌' : '✅'}</td>
                <td>${p.R.toFixed(4)}</td>
                <td>${p.nhom_uu_tien}</td>
              </tr>`
            )
            .join('');

          tableEl.innerHTML = `
            <thead class="table-dark">
              <tr><th colspan="4">Tham số chuẩn hóa min–max đã dùng (tái lập)</th></tr>
              <tr><th>Mã tiêu chí</th><th>min</th><th>max</th><th>N điểm có dữ liệu</th></tr>
            </thead>
            <tbody>${normRows || '<tr><td colspan="4" class="text-muted">Không có tiêu chí liên tục nào</td></tr>'}</tbody>
            <thead class="table-dark">
              <tr><th colspan="7">Top 100 điểm nguy cơ cao nhất (tổng ${ranked.filter((p) => p.R !== null).length} điểm có R)</th></tr>
              <tr><th>Hạng</th><th>Mã điểm</th><th>Khu vực</th><th>N mẫu</th><th>Không đạt?</th><th>R</th><th>Nhóm ưu tiên</th></tr>
            </thead>
            <tbody>${pointRows || '<tr><td colspan="7" class="text-muted">Chưa có điểm nào có R</td></tr>'}</tbody>
          `;
        }

        const RISK_GROUP_COLORS = {
          'Ưu tiên cao': '#c0392b',
          'Trung bình-cao': '#e67e22',
          'Trung bình': '#f1c40f',
          Thấp: '#27ae60',
        };

        /**
         * Mở modal bản đồ ưu tiên (Leaflet), tô màu điểm theo nhom_uu_tien.
         * Đọc trực tiếp từ monitoring_points (đã lưu ở Bước 2) để đảm bảo
         * hiển thị đúng kết quả run gần nhất, kể cả sau khi tải lại trang.
         */
        async function openRiskMapView() {
          const modal = document.getElementById('modal-risk-map');
          if (!modal) return;
          modal.style.display = 'block';

          const legend = document.getElementById('risk-map-legend');
          legend.innerHTML = Object.keys(RISK_GROUP_COLORS)
            .map(
              (g) =>
                `<span style="display:inline-block;margin-right:16px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${RISK_GROUP_COLORS[g]};margin-right:5px"></span>${g}</span>`
            )
            .join('');

          try {
            // fetchAllRows() để tránh bị PostgREST giới hạn 1000 dòng
            // (monitoring_points có thể có >1000 điểm có diem_r).
            const points = await fetchAllRows(
              'monitoring_points',
              'point_code, lat, lng, khu_vuc, n_mau, khong_dat, diem_r, xep_hang, nhom_uu_tien',
              (q) => q.not('diem_r', 'is', null)
            );
            console.log(`📊 [Tab 3 - Bản đồ ưu tiên] Đã tải ${points.length} điểm có diem_r.`);

            if (!riskMapLeaflet) {
              riskMapLeaflet = L.map('risk-map-container').setView([10.78, 106.7], 11);
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
              }).addTo(riskMapLeaflet);
            }
            // Xóa layer điểm cũ (nếu mở lại modal nhiều lần)
            if (riskMapLeaflet._riskLayerGroup) {
              riskMapLeaflet.removeLayer(riskMapLeaflet._riskLayerGroup);
            }
            const layerGroup = L.layerGroup();

            (points || []).forEach((p) => {
              const color = RISK_GROUP_COLORS[p.nhom_uu_tien] || '#999';
              const marker = L.circleMarker([p.lat, p.lng], {
                radius: 6,
                color: color,
                fillColor: color,
                fillOpacity: 0.8,
                weight: 1,
              }).bindPopup(`
                <b>Mã điểm:</b> ${p.point_code}<br>
                <b>Khu vực:</b> ${p.khu_vuc || '—'}<br>
                <b>R:</b> ${p.diem_r !== null ? Number(p.diem_r).toFixed(4) : '—'}<br>
                <b>Xếp hạng:</b> ${p.xep_hang ?? '—'}<br>
                <b>Nhóm ưu tiên:</b> ${p.nhom_uu_tien || '—'}<br>
                <b>Không đạt:</b> ${p.khong_dat === 1 ? 'Có' : 'Không'}<br>
                <b>Số mẫu:</b> ${p.n_mau}
              `);
              marker.addTo(layerGroup);
            });

            layerGroup.addTo(riskMapLeaflet);
            riskMapLeaflet._riskLayerGroup = layerGroup;

            if (points && points.length > 0) {
              const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
              riskMapLeaflet.fitBounds(bounds, { padding: [20, 20] });
            }

            setTimeout(() => riskMapLeaflet.invalidateSize(), 200);

            if (!points || points.length === 0) {
              showToast('warning', 'Chưa có điểm nào có điểm R để hiển thị trên bản đồ.');
            }
          } catch (err) {
            console.error('❌ Lỗi mở bản đồ ưu tiên:', err);
            showToast('error', 'Không thể tải bản đồ ưu tiên: ' + err.message);
          }
        }

        function closeRiskMapView() {
          const modal = document.getElementById('modal-risk-map');
          if (modal) modal.style.display = 'none';
        }

        // ================================================================
        // MODULE 4 — Tab 3 "Kiểm chứng" trong Modal "Kết quả nghiên cứu"
        // ----------------------------------------------------------------
        // Gọi Node route /api/validate (đã xác thực admin), route này
        // proxy sang stats_service (FastAPI, chỉ localhost:8000) — Node
        // KHÔNG tự tính bất kỳ công thức thống kê nào ở đây.
        // ================================================================
        let lastValidationResult = null; // cache JSON trả về từ /api/validate
        let rocChartInstance = null;

        // Map nhãn nhóm ưu tiên tiếng Việt (monitoring_points) -> mã ngắn
        // theo hợp đồng JSON của stats_service (cao|tb_cao|tb|thap).
        const RESEARCH_GROUP_LABEL_TO_CODE = {
          'Ưu tiên cao': 'cao',
          'Trung bình-cao': 'tb_cao',
          'Trung bình': 'tb',
          Thấp: 'thap',
        };

        // ================================================================
        // MODULE 5 — Tab 1 (Thực trạng, đơn vị=mẫu) & Tab 2 (Tiêu chí/trọng
        // số, đơn vị=tiêu chí) trong modal "Kết quả nghiên cứu".
        // NGUYÊN TẮC: chỉ đọc/hiển thị số liệu đã có trong DB (đếm, tỷ lệ %
        // mô tả trực tiếp trên water_reports; hoặc đọc nguyên trạng từ
        // delphi_criteria/criteria_weights/ahp_submissions/analysis_runs).
        // KHÔNG suy luận thống kê ở client (việc đó thuộc Module 4).
        // Ngoại lệ được phép: Wilson CI cho tỷ lệ mô tả (thống kê mô tả).
        // ================================================================
        const RESEARCH_GROUP_LABEL_FULL = {
          KN: 'Khả năng xảy ra',
          HQ: 'Hậu quả',
          DBP: 'Độ bao phủ giám sát',
        };
        let tab1Charts = {};
        let tab1Map = null;
        let tab2Chart = null;
        let latestAnalysisRun = null;

        /**
         * Wilson score interval cho 1 tỷ lệ — công thức toán học tiêu chuẩn
         * (không phải suy luận mô hình, chỉ là khoảng tin cậy mô tả tỷ lệ).
         * z=1.96 cho 95%.
         */
        function wilsonCI(successes, n, z = 1.96) {
          if (!n || n === 0) return [null, null];
          const p = successes / n;
          const denom = 1 + (z * z) / n;
          const center = p + (z * z) / (2 * n);
          const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
          return [(center - margin) / denom, (center + margin) / denom];
        }

        function pct(v, digits = 1) {
          return v === null || v === undefined ? '—' : (v * 100).toFixed(digits) + '%';
        }

        /**
         * TAB 1 — Thực trạng ngoại kiểm 2025 (đơn vị = MẪU, n=2.515).
         * Chỉ đếm/tỷ lệ mô tả trên water_reports + monitoring_points.
         * ---------------------------------------------------------------
         * QUAN TRỌNG: PostgREST/Supabase mặc định giới hạn 1000 dòng/truy
         * vấn. water_reports có ~2.515 dòng và monitoring_points có ~1.219
         * dòng — cả 2 đều VƯỢT 1000 nên BẮT BUỘC phải dùng fetchAllRows()
         * (phân trang .range()) để lấy đủ toàn bộ dữ liệu trước khi group.
         * Đồng thời dùng countRows() (count:'exact', head:true) để lấy
         * tổng số/số không đạt CHÍNH XÁC phía server cho các thẻ tổng quan,
         * không suy ra từ .length của mảng đã tải (dễ sai nếu logic tải
         * thay đổi sau này). Luôn TẢI LẠI MỚI mỗi lần gọi (không cache).
         */
        async function loadResearchTab1() {
          const container = document.getElementById('tab1-content');
          if (!container) return;
          container.innerHTML = '<p class="text-muted p-3"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</p>';

          try {
            const waterFilter = (q) =>
              q
                .gte('sampling_date', '2025-01-01')
                .lte('sampling_date', '2025-12-31')
                .eq('status', 'approved');

            // 1. Đếm CHÍNH XÁC phía server (không phụ thuộc số dòng đã tải)
            const [nMauCount, nMauKhongDatCount, nDiemCount, nDiemKhongDatCount] = await Promise.all([
              countRows('water_reports', waterFilter),
              countRows('water_reports', (q) => waterFilter(q).eq('hl_vs', 'K')),
              countRows('monitoring_points'),
              countRows('monitoring_points', (q) => q.eq('khong_dat', 1)),
            ]);
            console.log(
              `📊 [Tab 1] COUNT phía server — water_reports: ${nMauCount} (K=${nMauKhongDatCount}) · monitoring_points: ${nDiemCount} (không đạt=${nDiemKhongDatCount})`
            );

            // 2. Tải TOÀN BỘ hàng (phân trang, không giới hạn 1000) để group
            //    theo nhóm thông số/khu vực/loại mẫu và vẽ bản đồ.
            const samples = await fetchAllRows(
              'water_reports',
              'hl_vs, vs, hl_xn, hl_mt, maquan, loaimau_id, sampling_date',
              waterFilter
            );
            const points = await fetchAllRows(
              'monitoring_points',
              'point_code, lat, lng, khong_dat, n_mau, ty_le_khong_dat'
            );
            console.log(
              `📊 [Tab 1] Đã tải đủ (phân trang) — samples.length=${samples.length} (kỳ vọng=${nMauCount}) · points.length=${points.length} (kỳ vọng=${nDiemCount})`
            );

            if (samples.length !== nMauCount) {
              console.warn(
                `⚠️ [Tab 1] Số mẫu tải về (${samples.length}) KHÔNG khớp COUNT server (${nMauCount}) — kiểm tra lại phân trang.`
              );
            }
            if (points.length !== nDiemCount) {
              console.warn(
                `⚠️ [Tab 1] Số điểm tải về (${points.length}) KHÔNG khớp COUNT server (${nDiemCount}) — kiểm tra lại phân trang.`
              );
            }

            if (nMauCount === 0) {
              container.innerHTML = '<p class="text-muted p-3">Chưa có dữ liệu mẫu nước 2025 đã duyệt.</p>';
              return;
            }

            renderTab1(samples, points, {
              nMauCount,
              nMauKhongDatCount,
              nDiemCount,
              nDiemKhongDatCount,
            });
          } catch (err) {
            console.error('Lỗi tải Tab 1:', err);
            container.innerHTML = `<p class="text-danger p-3">Lỗi: ${err.message}</p>`;
          }
        }

        /**
         * Chuẩn hóa so sánh giá trị kết luận "Không đạt" ('K') — dùng chung
         * cho MỌI cột kết luận (vs/hl_xn/hl_mt/hl_vs), tránh lệch nhau do
         * khoảng trắng/chữ hoa-thường không nhất quán trong dữ liệu.
         */
        function isFailValue(val) {
          return String(val).trim().toUpperCase() === 'K';
        }

        /**
         * ĐỊNH NGHĨA DUY NHẤT "mẫu không đạt TỔNG HỢP" cho bảng theo khu
         * vực/loại mẫu + biểu đồ khu vực + bản đồ Tab 1 — LUÔN dựa trên cột
         * hl_vs (kết luận tổng hợp cuối cùng của mẫu), KHÔNG được so sánh
         * nhầm với giá trị của cột đang group (lỗi trước đây: countGroup so
         * sánh field đang group -vd maquan/loaimau_id- với 'K' thay vì so
         * sánh cột hl_vs thực sự chứa kết luận đạt/không đạt).
         * Bảng "theo nhóm thông số" (vs/hl_xn/hl_mt/hl_vs) là 4 CHỈ TIÊU
         * KẾT LUẬN ĐỘC LẬP khác nhau về nghiệp vụ nên KHÔNG dùng hàm này —
         * mỗi dòng của bảng đó tự kiểm tra đúng cột tương ứng bằng
         * isFailValue(row[code]).
         */
        function isSampleFail(row) {
          return isFailValue(row.hl_vs);
        }

        /**
         * Gộp nhóm theo 1 cột bất kỳ (vd maquan, loaimau_id) và đếm "không
         * đạt" LUÔN dựa trên isSampleFail(row) — tức cột hl_vs của chính
         * dòng đó — bất kể đang group theo cột nào.
         */
        function countGroup(samples, field) {
          const byKey = {};
          samples.forEach((s) => {
            const key = s[field] === null || s[field] === undefined ? '(trống)' : s[field];
            if (!byKey[key]) byKey[key] = { n: 0, k: 0 };
            byKey[key].n++;
            if (isSampleFail(s)) byKey[key].k++;
          });
          return byKey;
        }

        /**
         * Xuất 1 bảng HTML (id) ra file CSV — dùng chung cho mọi bảng Tab 1/2.
         */
        function exportTableCSV(tableId, fileNamePrefix) {
          const table = document.getElementById(tableId);
          if (!table) return showToast('warning', 'Không tìm thấy bảng để xuất.');
          const rows = Array.from(table.querySelectorAll('tr'));
          const csv = rows
            .map((row) =>
              Array.from(row.querySelectorAll('th,td'))
                .map((cell) => `"${cell.innerText.replace(/"/g, '""')}"`)
                .join(',')
            )
            .join('\n');
          const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
          link.click();
          showToast('success', 'Đã xuất CSV: ' + fileNamePrefix);
        }

        function renderTab1(samples, points, serverCounts) {
          const container = document.getElementById('tab1-content');
          // Ưu tiên số đếm CHÍNH XÁC từ server (count:'exact', head:true,
          // không giới hạn 1000) cho các thẻ tổng quan; fallback về
          // samples.length/points.length chỉ khi gọi hàm này thiếu tham
          // số thứ 3 (phòng hờ tương thích ngược).
          const nMau = serverCounts ? serverCounts.nMauCount : samples.length;
          const nMauKhongDat = serverCounts
            ? serverCounts.nMauKhongDatCount
            : samples.filter(isSampleFail).length;
          const nDiem = serverCounts ? serverCounts.nDiemCount : points.length;
          const nDiemKhongDat = serverCounts
            ? serverCounts.nDiemKhongDatCount
            : points.filter((p) => p.khong_dat === 1).length;

          const ciMau = wilsonCI(nMauKhongDat, nMau);
          const ciDiem = wilsonCI(nDiemKhongDat, nDiem);

          // --- Bảng theo nhóm thông số (vs, hl_xn, hl_mt, hl_vs) ---
          const paramGroups = [
            { code: 'vs', label: 'Vi sinh (vs)' },
            { code: 'hl_xn', label: 'Hóa lý phòng XN (hl_xn)' },
            { code: 'hl_mt', label: 'Hóa lý hiện trường (hl_mt)' },
            { code: 'hl_vs', label: 'Tổng hợp (hl_vs)' },
          ];
          const paramRows = paramGroups
            .map((g) => {
              const n = samples.filter((s) => s[g.code] !== null && s[g.code] !== undefined).length;
              const k = samples.filter((s) => isFailValue(s[g.code])).length;
              const rate = n > 0 ? k / n : null;
              const ci = wilsonCI(k, n);
              return `<tr><td>${g.label}</td><td>${n}</td><td>${k}</td><td>${pct(rate)}</td><td>${
                ci[0] !== null ? `[${pct(ci[0])}, ${pct(ci[1])}]` : '—'
              }</td></tr>`;
            })
            .join('');

          // --- Bảng theo khu vực (maquan) ---
          const byKhuVuc = countGroup(samples, 'maquan');
          const khuVucRows = Object.keys(byKhuVuc)
            .sort()
            .map((kv) => {
              const { n, k } = byKhuVuc[kv];
              const ci = wilsonCI(k, n);
              return `<tr><td>${kv}</td><td>${n}</td><td>${k}</td><td>${pct(k / n)}</td><td>[${pct(ci[0])}, ${pct(
                ci[1]
              )}]</td></tr>`;
            })
            .join('');

          // --- Bảng theo loại mẫu (loaimau_id) ---
          const byLoaiMau = countGroup(samples, 'loaimau_id');
          const loaiMauRows = Object.keys(byLoaiMau)
            .sort((a, b) => byLoaiMau[b].n - byLoaiMau[a].n)
            .map((lm) => {
              const { n, k } = byLoaiMau[lm];
              const ci = wilsonCI(k, n);
              return `<tr><td>${lm}</td><td>${n}</td><td>${k}</td><td>${pct(k / n)}</td><td>[${pct(ci[0])}, ${pct(
                ci[1]
              )}]</td></tr>`;
            })
            .join('');

          container.innerHTML = `
            <div class="tab1-unit-group tab1-unit-mau">
              <div class="tab1-unit-title"><i class="fa-solid fa-vial"></i> CẤP MẪU (n = ${nMau.toLocaleString('vi-VN')})</div>
              <div class="kamet-summary-bar" style="margin:0">
                <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">Tổng mẫu: <b>${nMau.toLocaleString('vi-VN')}</b></span>
                <span class="kamet-summary-chip kamet-chip-loai">Mẫu không đạt: <b>${nMauKhongDat}</b> (${pct(nMauKhongDat / nMau)}, KTC95%: [${pct(ciMau[0])}, ${pct(ciMau[1])}])</span>
              </div>
            </div>
            <div class="tab1-unit-group tab1-unit-diem">
              <div class="tab1-unit-title"><i class="fa-solid fa-map-pin"></i> CẤP ĐIỂM (N = ${nDiem.toLocaleString('vi-VN')})</div>
              <div class="kamet-summary-bar" style="margin:0">
                <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">Tổng điểm: <b>${nDiem.toLocaleString('vi-VN')}</b></span>
                <span class="kamet-summary-chip kamet-chip-loai">Điểm không đạt: <b>${nDiemKhongDat}</b> (${nDiem > 0 ? pct(nDiemKhongDat / nDiem) : '—'}${nDiem > 0 ? `, KTC95%: [${pct(ciDiem[0])}, ${pct(ciDiem[1])}]` : ''})</span>
              </div>
            </div>
            <p style="font-size:11.5px;color:#888;margin-top:10px">
              <i class="fa-solid fa-circle-info"></i> Lưu ý: số <b>MẪU</b> không đạt (${nMauKhongDat}) khác số <b>ĐIỂM</b> không đạt (${nDiemKhongDat})
              vì một điểm có nhiều mẫu; một điểm tính "không đạt" nếu có ≥1 mẫu không đạt trong năm.
            </p>

            <h6 class="mt-3">Tỷ lệ không đạt theo nhóm thông số</h6>
            <p class="tab1-table-subtitle">Đơn vị: mẫu (n = ${nMau.toLocaleString('vi-VN')}); tổng số mẫu không đạt = ${nMauKhongDat}.</p>
            <table id="table-thuctrang-nhomts" class="table table-sm table-bordered">
              <thead><tr><th>Nhóm thông số</th><th>N mẫu</th><th>n không đạt</th><th>%</th><th>KTC 95% (Wilson)</th></tr></thead>
              <tbody>${paramRows}</tbody>
            </table>

            <div style="display:flex; gap:20px; flex-wrap:wrap; margin: 14px 0">
              <div style="flex:1;min-width:280px"><canvas id="chart-tab1-nhomts" height="200"></canvas></div>
              <div style="flex:1;min-width:280px"><canvas id="chart-tab1-khuvuc" height="200"></canvas></div>
            </div>

            <h6 class="mt-3">Tỷ lệ không đạt theo khu vực (quận/địa bàn)</h6>
            <p class="tab1-table-subtitle">Đơn vị: mẫu (n = ${nMau.toLocaleString('vi-VN')}); tổng số mẫu không đạt = ${nMauKhongDat}.</p>
            <table id="table-thuctrang-khuvuc" class="table table-sm table-bordered">
              <thead><tr><th>Khu vực (maquan)</th><th>N mẫu</th><th>n không đạt</th><th>%</th><th>KTC 95%</th></tr></thead>
              <tbody>${khuVucRows}</tbody>
            </table>

            <h6 class="mt-3">Tỷ lệ không đạt theo loại mẫu</h6>
            <p class="tab1-table-subtitle">Đơn vị: mẫu (n = ${nMau.toLocaleString('vi-VN')}); tổng số mẫu không đạt = ${nMauKhongDat}.</p>
            <table id="table-thuctrang-loaimau" class="table table-sm table-bordered">
              <thead><tr><th>Loại mẫu (loaimau_id)</th><th>N mẫu</th><th>n không đạt</th><th>%</th><th>KTC 95%</th></tr></thead>
              <tbody>${loaiMauRows}</tbody>
            </table>

            <h6 class="mt-3">Bản đồ phân bố ${nDiem.toLocaleString('vi-VN')} điểm giám sát (đạt/không đạt)</h6>
            <p class="tab1-table-subtitle">Đơn vị: điểm (N = ${nDiem.toLocaleString('vi-VN')}); bấm vào chú giải (legend) trên bản đồ để lọc theo Đạt/Không đạt.</p>
            <div id="tab1-map-container" style="height: 450px; width: 100%; border-radius: 10px; overflow: hidden"></div>
          `;

          drawTab1Charts(paramGroups, samples, byKhuVuc);
          drawTab1Map(points);
        }

        function drawTab1Charts(paramGroups, samples, byKhuVuc) {
          ['nhomts', 'khuvuc'].forEach((k) => {
            if (tab1Charts[k]) tab1Charts[k].destroy();
          });

          const paramLabels = paramGroups.map((g) => g.label);
          const paramRates = paramGroups.map((g) => {
            const n = samples.filter((s) => s[g.code] !== null && s[g.code] !== undefined).length;
            const k = samples.filter((s) => isFailValue(s[g.code])).length;
            return n > 0 ? +((k / n) * 100).toFixed(2) : 0;
          });

          const nhomtsCanvas = document.getElementById('chart-tab1-nhomts');
          if (nhomtsCanvas) {
            tab1Charts.nhomts = new Chart(nhomtsCanvas.getContext('2d'), {
              type: 'bar',
              data: {
                labels: paramLabels,
                datasets: [{ label: '% không đạt', data: paramRates, backgroundColor: '#f26522' }],
              },
              options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Tỷ lệ không đạt theo nhóm thông số (%)' } },
                scales: { y: { beginAtZero: true } },
              },
            });
          }

          const khuVucLabels = Object.keys(byKhuVuc).sort();
          const khuVucRates = khuVucLabels.map((kv) => {
            const { n, k } = byKhuVuc[kv];
            return +((k / n) * 100).toFixed(2);
          });
          const khuVucCanvas = document.getElementById('chart-tab1-khuvuc');
          if (khuVucCanvas) {
            tab1Charts.khuvuc = new Chart(khuVucCanvas.getContext('2d'), {
              type: 'bar',
              data: {
                labels: khuVucLabels,
                datasets: [{ label: '% không đạt', data: khuVucRates, backgroundColor: '#008b99' }],
              },
              options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Tỷ lệ không đạt theo khu vực (%)' } },
                scales: { y: { beginAtZero: true } },
              },
            });
          }
        }

        let tab1FilterState = 'all'; // 'all' | 'dat' | 'khongdat' — trạng thái lọc legend
        let tab1PointsCache = []; // cache validPoints để lọc lại khi bấm legend, không cần load lại DB

        function drawTab1Map(points) {
          const container = document.getElementById('tab1-map-container');
          // Chỉ lấy điểm có lat/lng hợp lệ (khác null/0) — phòng dữ liệu
          // lỗi, dù hiện tại cả 1.219 điểm monitoring_points đều hợp lệ.
          const validPoints = (points || []).filter(
            (p) => p.lat !== null && p.lat !== undefined && p.lat !== 0 && p.lng !== null && p.lng !== undefined && p.lng !== 0
          );
          if (!container || validPoints.length === 0) return;

          tab1PointsCache = validPoints;
          tab1FilterState = 'all';

          if (tab1Map) {
            tab1Map.remove();
            tab1Map = null;
          }
          tab1Map = L.map('tab1-map-container').setView([10.78, 106.7], 10);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
          }).addTo(tab1Map);

          drawTab1BoundaryOverlay();
          setupTab1MapLegend(validPoints);
          renderTab1MapMarkers('all');
          setTimeout(() => tab1Map.invalidateSize(), 200);
        }

        /**
         * (C) Ranh giới hành chính TP.HCM (sau sáp nhập) — TÁI SỬ DỤNG đúng
         * lớp GeoJSON app đã có sẵn (bảng settings, name='HCM_Boundaries',
         * nạp qua loadHCMBoundary() -> lưu ở window.hcmGeoJSON, dùng chung
         * với bản đồ chính). Thứ tự lớp: basemap -> ranh giới -> cluster.
         * Chỉ vẽ đường viền (fillOpacity rất thấp) để không che điểm.
         * Nếu app CHƯA có lớp này (window.hcmGeoJSON rỗng và không tải
         * được) -> KHÔNG tự bịa ranh giới, chỉ log cảnh báo rõ ràng.
         */
        function drawTab1BoundaryOverlay() {
          const draw = () => {
            if (!window.hcmGeoJSON || !tab1Map) return;
            try {
              L.geoJSON(window.hcmGeoJSON, {
                style: { color: '#34495e', weight: 1, opacity: 0.8, fillOpacity: 0.02 },
                interactive: false,
              }).addTo(tab1Map);
              console.log('🗺️ [Tab 1] Đã vẽ overlay ranh giới TP.HCM (window.hcmGeoJSON) lên bản đồ.');
            } catch (e) {
              console.warn('⚠️ [Tab 1] Không thể vẽ ranh giới TP.HCM:', e.message);
            }
          };

          if (window.hcmGeoJSON) {
            draw();
          } else if (typeof loadHCMBoundary === 'function') {
            loadHCMBoundary()
              .then(draw)
              .catch((e) => console.warn('⚠️ [Tab 1] loadHCMBoundary() lỗi:', e.message));
          } else {
            console.warn(
              '⚠️ [Tab 1] App chưa có lớp ranh giới TP.HCM khả dụng. Bỏ qua overlay, chỉ dùng basemap + fit bounds.'
            );
          }
        }

        /**
         * (B) Khởi tạo legend dạng NÚT BẤM (góc dưới phải bản đồ) để lọc
         * điểm theo Đạt/Không đạt. Số đếm hiển thị LUÔN là tổng thật (không
         * đổi theo bộ lọc) để người xem biết bối cảnh.
         */
        function setupTab1MapLegend(validPoints) {
          if (tab1Map._legendControl) return;

          const nDat = validPoints.filter((p) => p.khong_dat !== 1).length;
          const nKhongDat = validPoints.filter((p) => p.khong_dat === 1).length;

          const legendControl = L.control({ position: 'bottomright' });
          legendControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'tab1-legend-box');
            div.innerHTML = `
              <span id="tab1-legend-all" class="tab1-legend-item active" title="Bấm để lọc">Tất cả</span>
              <span id="tab1-legend-dat" class="tab1-legend-item" title="Bấm để lọc">🟢 Đạt (n=${nDat})</span>
              <span id="tab1-legend-khongdat" class="tab1-legend-item" title="Bấm để lọc">🔴 Không đạt ≥1 mẫu (n=${nKhongDat})</span>
            `;
            L.DomEvent.disableClickPropagation(div);
            div.querySelector('#tab1-legend-all').addEventListener('click', () => setTab1MapFilter('all'));
            div.querySelector('#tab1-legend-dat').addEventListener('click', () => setTab1MapFilter('dat'));
            div.querySelector('#tab1-legend-khongdat').addEventListener('click', () => setTab1MapFilter('khongdat'));
            return div;
          };
          legendControl.addTo(tab1Map);
          tab1Map._legendControl = legendControl;
        }

        /**
         * Bấm lại vào mục đang active (hoặc "Tất cả") sẽ quay về hiển thị
         * cả hai; bấm "Đạt"/"Không đạt" sẽ chỉ hiển thị đúng nhóm đó.
         */
        function setTab1MapFilter(newState) {
          tab1FilterState = tab1FilterState === newState ? 'all' : newState;
          ['all', 'dat', 'khongdat'].forEach((key) => {
            const el = document.getElementById(`tab1-legend-${key}`);
            if (el) el.classList.toggle('active', tab1FilterState === key);
          });
          renderTab1MapMarkers(tab1FilterState);
        }

        /**
         * Vẽ marker cho tập điểm ĐÃ LỌC theo trạng thái legend vào 1
         * cluster group mới (thay thế cluster cũ). Cluster + fit bounds
         * cập nhật theo đúng tập điểm đang hiển thị. Popup luôn đầy đủ
         * (point_code, n_mau, số mẫu không đạt) ở mọi trạng thái lọc.
         */
        function renderTab1MapMarkers(filterState) {
          if (!tab1Map) return;

          const pointsToShow = tab1PointsCache.filter((p) => {
            if (filterState === 'dat') return p.khong_dat !== 1;
            if (filterState === 'khongdat') return p.khong_dat === 1;
            return true;
          });

          if (tab1Map._clusterGroup) {
            tab1Map.removeLayer(tab1Map._clusterGroup);
          }
          const clusterGroup =
            typeof L.markerClusterGroup === 'function' ? L.markerClusterGroup() : L.layerGroup();

          pointsToShow.forEach((p) => {
            const color = p.khong_dat === 1 ? '#c0392b' : '#27ae60';
            const soMauKhongDat = Math.round((p.n_mau || 0) * (p.ty_le_khong_dat || 0));
            L.circleMarker([p.lat, p.lng], {
              radius: 6,
              color,
              fillColor: color,
              fillOpacity: 0.85,
              weight: 1,
            })
              .bindPopup(
                `<b>Mã điểm:</b> ${p.point_code}<br><b>Số mẫu:</b> ${p.n_mau}<br><b>Số mẫu không đạt:</b> ${soMauKhongDat}<br><b>Kết luận điểm:</b> ${
                  p.khong_dat === 1 ? 'Không đạt' : 'Đạt'
                }<br><b>Tỷ lệ không đạt:</b> ${((p.ty_le_khong_dat || 0) * 100).toFixed(1)}%`
              )
              .addTo(clusterGroup);
          });
          clusterGroup.addTo(tab1Map);
          tab1Map._clusterGroup = clusterGroup;

          if (pointsToShow.length > 0) {
            const bounds = L.latLngBounds(pointsToShow.map((p) => [p.lat, p.lng]));
            tab1Map.fitBounds(bounds, { padding: [20, 20] });
          }
        }

        /**
         * TAB 2 — Bộ tiêu chí & trọng số (đơn vị = TIÊU CHÍ).
         * Chỉ đọc nguyên trạng từ delphi_criteria/criteria_weights/ahp_submissions.
         */
        async function loadResearchTab2() {
          const container = document.getElementById('tab2-content');
          if (!container) return;
          container.innerHTML = '<p class="text-muted p-3"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</p>';

          try {
            const [{ data: criteria, error: cErr }, { data: weights, error: wErr }, { data: submissions, error: sErr }] =
              await Promise.all([
                supabaseClient.from('delphi_criteria').select('*').order('thu_tu', { ascending: true }),
                supabaseClient.from('criteria_weights').select('*'),
                supabaseClient.from('ahp_submissions').select('ma_chuyen_gia, ma_tran_key, cr'),
              ]);
            if (cErr) throw cErr;
            if (wErr) throw wErr;
            if (sErr) throw sErr;

            renderTab2(criteria || [], weights || [], submissions || []);
          } catch (err) {
            console.error('Lỗi tải Tab 2:', err);
            container.innerHTML = `<p class="text-danger p-3">Lỗi: ${err.message}</p>`;
          }
        }

        function renderTab2(criteria, weights, submissions) {
          const container = document.getElementById('tab2-content');

          const kametRows = criteria
            .map((c) => {
              return `<tr>
                <td><b>${c.ma_tieu_chi}</b></td>
                <td>${c.ten_tieu_chi}</td>
                <td>${RESEARCH_GROUP_LABEL_FULL[c.nhom] || c.nhom}</td>
                <td>${c.mdqi !== null ? Number(c.mdqi).toFixed(2) : '—'}</td>
                <td>${c.mqi !== null ? Number(c.mqi).toFixed(2) : '—'}</td>
                <td>${c.qqi !== null ? Number(c.qqi).toFixed(2) : '—'}</td>
                <td>${c.vqi !== null ? Number(c.vqi).toFixed(1) + '%' : '—'}</td>
                <td>${kametBadge(c.trang_thai)}</td>
              </tr>`;
            })
            .join('');

          const sumW = weights.reduce((s, w) => s + Number(w.w_toan_cuc), 0);
          const sumOk = weights.length > 0 && Math.abs(sumW - 1) < 0.001;
          const weightRows = [...weights]
            .sort((a, b) => Number(b.w_toan_cuc) - Number(a.w_toan_cuc))
            .map(
              (w) => `<tr>
                <td><b>${w.ma_tieu_chi}</b></td>
                <td>${RESEARCH_GROUP_LABEL_FULL[w.nhom] || w.nhom}</td>
                <td>${Number(w.w_nhom).toFixed(4)}</td>
                <td>${Number(w.w_cuc_bo).toFixed(4)}</td>
                <td><b>${Number(w.w_toan_cuc).toFixed(4)}</b></td>
              </tr>`
            )
            .join('');

          const crByMatrix = {};
          submissions.forEach((s) => {
            if (!crByMatrix[s.ma_tran_key]) crByMatrix[s.ma_tran_key] = [];
            crByMatrix[s.ma_tran_key].push(Number(s.cr));
          });
          const crRows = Object.keys(crByMatrix)
            .map((key) => {
              const crs = crByMatrix[key];
              const avgCr = crs.reduce((s, v) => s + v, 0) / crs.length;
              const crOk = avgCr <= 0.1;
              return `<tr><td>${key}</td><td>${crs.length}</td><td class="${
                crOk ? '' : 'kamet-diff-flag'
              }">${avgCr.toFixed(4)} ${crOk ? '✅' : '⚠️'}</td></tr>`;
            })
            .join('');

          const nExpertsAhp = new Set(submissions.map((s) => s.ma_chuyen_gia)).size;

          container.innerHTML = buildTab2Html(criteria, weights, kametRows, weightRows, crRows, sumW, sumOk, nExpertsAhp);
          drawTab2Chart(weights);
        }

        function buildTab2Html(criteria, weights, kametRows, weightRows, crRows, sumW, sumOk, nExpertsAhp) {
          return `
            <div class="kamet-summary-bar">
              <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
                ${criteria.length} tiêu chí ứng viên · ${criteria.filter((c) => c.trang_thai === 'giu_lai').length} tiêu chí giữ lại
              </span>
              <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
                ${nExpertsAhp} chuyên gia tham gia AHP
              </span>
              <span class="kamet-summary-chip ${sumOk ? 'kamet-chip-giu' : 'kamet-chip-loai'}">
                Tổng trọng số toàn cục: ${sumW.toFixed(4)} ${
            sumOk ? '✅' : weights.length === 0 ? '(chưa có dữ liệu)' : '❌ lệch ≥0.001'
          }
              </span>
            </div>

            <h6 class="mt-3">Bảng đồng thuận Delphi (KAMET)</h6>
            <table id="table-kamet-tab2" class="table table-sm table-bordered">
              <thead><tr><th>Mã</th><th>Tên tiêu chí</th><th>Nhóm</th><th>Mdqi</th><th>Mqi</th><th>Qqi</th><th>Vqi(%)</th><th>Trạng thái</th></tr></thead>
              <tbody>${kametRows || '<tr><td colspan="8" class="text-muted">Chưa có dữ liệu KAMET</td></tr>'}</tbody>
            </table>

            <h6 class="mt-3">Bảng trọng số AHP (tiêu chí đã giữ lại)</h6>
            ${
              weights.length > 0
                ? `<table id="table-ahp-weights-tab2" class="table table-sm table-bordered">
                    <thead><tr><th>Mã</th><th>Nhóm</th><th>w_nhóm</th><th>w_cục_bộ</th><th>w_toàn_cục</th></tr></thead>
                    <tbody>${weightRows}<tr class="table-secondary fw-bold"><td colspan="4">TỔNG</td><td>${sumW.toFixed(
                      4
                    )}</td></tr></tbody>
                  </table>`
                : '<p class="text-muted">Chưa có trọng số AHP (chạy Module 2 "Tổng hợp trọng số AHP" trước).</p>'
            }

            <div style="display:flex; gap:20px; flex-wrap:wrap; margin: 14px 0">
              <div style="flex:1;min-width:280px"><canvas id="chart-tab2-weights" height="220"></canvas></div>
              <div style="flex:1;min-width:280px">
                <h6>CR tổng hợp theo ma trận AHP</h6>
                <table class="table table-sm table-bordered">
                  <thead><tr><th>Ma trận</th><th>N chuyên gia</th><th>CR trung bình</th></tr></thead>
                  <tbody>${crRows || '<tr><td colspan="3" class="text-muted">Chưa có lượt nộp AHP</td></tr>'}</tbody>
                </table>
              </div>
            </div>

            <h6 class="mt-3">Cây phân cấp AHP</h6>
            <div id="tab2-hierarchy">${renderAhpHierarchyTree(weights)}</div>
          `;
        }

        function renderAhpHierarchyTree(weights) {
          if (!weights || weights.length === 0)
            return '<p class="text-muted">Chưa có dữ liệu trọng số để dựng cây.</p>';
          const byGroup = {};
          weights.forEach((w) => {
            if (!byGroup[w.nhom]) byGroup[w.nhom] = [];
            byGroup[w.nhom].push(w);
          });
          return Object.keys(byGroup)
            .map((g) => {
              const items = byGroup[g]
                .sort((a, b) => Number(b.w_toan_cuc) - Number(a.w_toan_cuc))
                .map(
                  (w) =>
                    `<li>${w.ma_tieu_chi} — w_cục_bộ=${Number(w.w_cuc_bo).toFixed(3)}, w_toàn_cục=${Number(
                      w.w_toan_cuc
                    ).toFixed(3)}</li>`
                )
                .join('');
              const wNhom = byGroup[g][0] ? Number(byGroup[g][0].w_nhom).toFixed(3) : '—';
              return `<div style="margin-bottom:8px"><b>${
                RESEARCH_GROUP_LABEL_FULL[g] || g
              }</b> (w_nhóm=${wNhom})<ul>${items}</ul></div>`;
            })
            .join('');
        }

        function drawTab2Chart(weights) {
          if (tab2Chart) tab2Chart.destroy();
          const canvas = document.getElementById('chart-tab2-weights');
          if (!canvas || weights.length === 0) return;

          const sorted = [...weights].sort((a, b) => Number(b.w_toan_cuc) - Number(a.w_toan_cuc));
          tab2Chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: sorted.map((w) => w.ma_tieu_chi),
              datasets: [
                {
                  label: 'Trọng số toàn cục',
                  data: sorted.map((w) => Number(w.w_toan_cuc)),
                  backgroundColor: '#008b99',
                },
              ],
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              plugins: { title: { display: true, text: 'Xếp hạng trọng số toàn cục các tiêu chí' } },
            },
          });
        }

        /**
         * Xuất báo cáo tổng PDF: gộp trang bìa + Tab 1 + Tab 2 + Tab 3.
         */
        async function exportResearchFullPDF() {
          showToast('info', 'Đang tạo báo cáo tổng PDF (có thể mất vài giây)...');
          const originalActiveTab =
            document.querySelector('#modal-research .tab-button.active')?.getAttribute('data-research-tab') ||
            'kiemchung';

          try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const {
              data: { user },
            } = await supabaseClient.auth.getUser();
            pdf.setFontSize(18);
            pdf.text('BÁO CÁO KẾT QUẢ NGHIÊN CỨU', pageWidth / 2, 40, { align: 'center' });
            pdf.setFontSize(13);
            pdf.text('Bộ tiêu chí xác định vị trí điểm lấy mẫu giám sát ngoại kiểm', pageWidth / 2, 50, {
              align: 'center',
            });
            pdf.setFontSize(11);
            pdf.text(`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, pageWidth / 2, 70, { align: 'center' });
            pdf.text(`Người xuất: ${(user && user.email) || 'admin'}`, pageWidth / 2, 78, { align: 'center' });
            if (latestAnalysisRun) {
              pdf.text(`Run: ${new Date(latestAnalysisRun.run_time).toLocaleString('vi-VN')}`, pageWidth / 2, 86, {
                align: 'center',
              });
            }

            const tabsToCapture = [
              { id: 'research-tab-thuctrang', key: 'thuctrang', title: 'TAB 1: THỰC TRẠNG NGOẠI KIỂM 2025' },
              { id: 'research-tab-tieuchi', key: 'tieuchi', title: 'TAB 2: BỘ TIÊU CHÍ & TRỌNG SỐ' },
              { id: 'research-tab-kiemchung', key: 'kiemchung', title: 'TAB 3: KIỂM CHỨNG & BẢN ĐỒ ƯU TIÊN' },
            ];

            for (const tab of tabsToCapture) {
              switchResearchTab(tab.key);
              await new Promise((r) => setTimeout(r, 400));
              const element = document.getElementById(tab.id);
              const canvas = await html2canvas(element, { scale: 1.3, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgHeight = (canvas.height * pageWidth) / canvas.width;

              pdf.addPage();
              pdf.setFontSize(13);
              pdf.text(tab.title, 10, 12);
              pdf.addImage(imgData, 'PNG', 0, 18, pageWidth, Math.min(imgHeight, pageHeight - 25));
            }

            const totalPages = pdf.internal.getNumberOfPages();
            const runLabel = latestAnalysisRun
              ? `Run: ${new Date(latestAnalysisRun.run_time).toISOString()}`
              : 'Chưa có analysis_run';
            for (let i = 1; i <= totalPages; i++) {
              pdf.setPage(i);
              pdf.setFontSize(8);
              pdf.setTextColor(120);
              pdf.text(`${runLabel} · Trang ${i}/${totalPages}`, 10, pageHeight - 6);
            }

            pdf.save(`Bao_cao_ket_qua_nghien_cuu_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast('success', 'Đã xuất báo cáo tổng PDF!');
          } catch (err) {
            console.error('Lỗi xuất báo cáo tổng:', err);
            showToast('error', 'Lỗi khi xuất báo cáo: ' + err.message);
          } finally {
            switchResearchTab(originalActiveTab);
          }
        }

        // ----------------------------------------------------------------
        // 5.4 (TÙY CHỌN) — Diễn giải bằng lời có kiểm soát (Gemini AI)
        // Mặc định ẨN theo cờ cấu hình. Bật bằng enableResearchAiExplain()
        // từ console nếu cần demo (không tự động bật để tránh gọi AI ngoài ý muốn).
        // ----------------------------------------------------------------
        const RESEARCH_AI_EXPLAIN_ENABLED = false;

        function enableResearchAiExplain() {
          const btn = document.getElementById('btn-ai-explain');
          if (btn) btn.style.display = 'inline-block';
        }
        if (RESEARCH_AI_EXPLAIN_ENABLED) {
          document.addEventListener('DOMContentLoaded', enableResearchAiExplain);
        }

        /**
         * Gửi các con số ĐÃ TÍNH SẴN (Module 4) cho Gemini, yêu cầu CHỈ viết
         * diễn giải bằng lời — cấm bịa/tính lại số. Kết quả gắn nhãn rõ ràng
         * và KHÔNG tự động đưa vào PDF.
         */
        async function generateAiExplanation() {
          if (!lastValidationResult) {
            return showToast('warning', 'Chưa có kết quả kiểm chứng (Tab 3) để diễn giải.');
          }
          const box = document.getElementById('ai-explanation-box');
          box.style.display = 'block';
          box.innerHTML =
            '<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Đang tạo diễn giải...</p>';

          const r = lastValidationResult;
          const summaryNumbers = {
            n_diem: r.metadata.n_points,
            ty_le_khong_dat: r.metadata.ty_le_khong_dat,
            chi_square_p: r.group_comparison.test ? r.group_comparison.test.p_value : null,
            OR_don_bien: r.logistic_univariate.result ? r.logistic_univariate.result.OR : null,
            AUC: r.roc_auc.auc ? r.roc_auc.auc.value : null,
          };

          const prompt = `Bạn là trợ lý viết báo cáo khoa học. Dưới đây là các con số ĐÃ ĐƯỢC TÍNH SẴN (không được tính lại, không được bịa thêm số liệu khác): ${JSON.stringify(
            summaryNumbers
          )}. Hãy viết 1 đoạn diễn giải ngắn (3-5 câu) bằng tiếng Việt, chỉ dùng lời văn mô tả ý nghĩa của các con số này, không thêm số liệu nào khác ngoài những gì đã cho.`;

          try {
            const { data, error: fnErr } = await supabaseClient.functions.invoke('gemini-proxy', {
              body: { payload: { contents: [{ parts: [{ text: prompt }] }] } },
            });
            if (fnErr) throw fnErr;
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được phản hồi từ AI.';
            box.innerHTML = `
              <div class="ahp-single-note">
                <b><i class="fa-solid fa-robot"></i> Nội dung do AI hỗ trợ soạn — cần nghiên cứu viên kiểm chứng:</b>
                <p style="margin-top:8px">${String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>
              </div>`;
          } catch (err) {
            box.innerHTML = `<p class="text-danger">Lỗi khi gọi AI: ${err.message}</p>`;
          }
        }

        function openResearchModal() {
          const modal = document.getElementById('modal-research');
          if (modal) modal.style.display = 'block';
          loadLatestAnalysisRunBadge();
          loadResearchTab1();
          loadResearchTab2();
        }

        function closeResearchModal() {
          const modal = document.getElementById('modal-research');
          if (modal) modal.style.display = 'none';
        }

        /**
         * Đọc analysis_run MỚI NHẤT để mọi tab hiển thị nhất quán cùng 1 lần
         * chạy (đúng yêu cầu 5.3: "mọi số hiển thị truy được về run đã lưu").
         */
        async function loadLatestAnalysisRunBadge() {
          const badge = document.getElementById('research-run-badge');
          if (!badge) return;
          try {
            const { data, error } = await supabaseClient
              .from('analysis_runs')
              .select('run_time, nguoi_thuc_hien, n_diem, n_khong_dat, trong_so, ket_qua_kiem_dinh')
              .order('run_time', { ascending: false })
              .limit(1);
            if (error) throw error;

            if (!data || data.length === 0) {
              latestAnalysisRun = null;
              badge.innerHTML = `<div class="ahp-single-note">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Chưa có <code>analysis_run</code> nào được lưu. Vui lòng chạy
                Module 3 ("CHẤM ĐIỂM NGUY CƠ") và Module 4 ("CHẠY KIỂM CHỨNG
                THỐNG KÊ") trước để có bằng chứng đầy đủ. Tab 1/2 vẫn hiển thị
                được số liệu mô tả trực tiếp từ DB bên dưới.
              </div>`;
              return;
            }

            const run = data[0];
            latestAnalysisRun = run;
            const weightsVersion = Array.isArray(run.trong_so) && run.trong_so[0]
              ? new Date(run.trong_so[0].updated_at).toLocaleString('vi-VN')
              : '—';
            badge.innerHTML = `<span class="kamet-summary-chip kamet-chip-giu">
              <i class="fa-solid fa-shield-halved"></i> Kết quả từ run:
              ${new Date(run.run_time).toLocaleString('vi-VN')} · người chạy: ${run.nguoi_thuc_hien || '—'}
              · N=${run.n_diem ?? '—'} điểm (${run.n_khong_dat ?? '—'} không đạt)
              · trọng số version: ${weightsVersion}
            </span>`;
          } catch (err) {
            console.error('Lỗi tải analysis_run:', err);
            badge.innerHTML = `<p class="text-muted">Không thể tải thông tin run gần nhất: ${err.message}</p>`;
          }
        }

        function switchResearchTab(tabName) {
          document
            .querySelectorAll('#modal-research .tab-button')
            .forEach((btn) => btn.classList.remove('active'));
          const activeBtn = document.querySelector(
            `#modal-research .tab-button[data-research-tab="${tabName}"]`
          );
          if (activeBtn) activeBtn.classList.add('active');

          document
            .querySelectorAll('#modal-research .tab-panel')
            .forEach((panel) => panel.classList.remove('active'));
          const panel = document.getElementById(`research-tab-${tabName}`);
          if (panel) panel.classList.add('active');
        }

        /**
         * Lấy monitoring_points (đã có R/nhóm/khong_dat) + features động
         * theo criteria_weights hiện có (JOIN point_attributes), gọi
         * /api/validate (Node xác thực admin -> proxy sang stats_service),
         * render kết quả và lưu 1 analysis_run bất biến.
         */
        async function runStatisticalValidation() {
          const btn = document.getElementById('btn-run-validation');
          const progressEl = document.getElementById('validation-progress');
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG CHẠY...';
          }
          progressEl.innerText = '⏳ Đang tải dữ liệu điểm...';

          try {
            // fetchAllRows() để tránh bị PostgREST giới hạn 1000 dòng —
            // monitoring_points có thể có N > 1000 điểm đã tính diem_r,
            // nếu bị cắt sẽ làm SAI N thực tế đưa vào kiểm định thống kê.
            const points = await fetchAllRows(
              'monitoring_points',
              'point_code, khong_dat, diem_r, nhom_uu_tien',
              (q) => q.not('diem_r', 'is', null)
            );
            console.log(`📊 [Module 4] Đã tải ${points.length} điểm có diem_r để kiểm chứng thống kê.`);

            if (!points || points.length < 10) {
              progressEl.innerHTML =
                '⚠️ Cần tối thiểu 10 điểm đã có điểm R (chạy Module 3 trước).';
              return;
            }

            const { data: weightRows } = await supabaseClient
              .from('criteria_weights')
              .select('ma_tieu_chi');
            const featureCodes = (weightRows || []).map((w) => w.ma_tieu_chi);

            let attrByCode = {};
            if (featureCodes.length > 0) {
              const pointCodes = points.map((p) => p.point_code);
              let attrRows = [];
              const CHUNK = 300;
              for (let i = 0; i < pointCodes.length; i += CHUNK) {
                const { data } = await supabaseClient
                  .from('point_attributes')
                  .select('*')
                  .in('point_code', pointCodes.slice(i, i + CHUNK));
                attrRows = attrRows.concat(data || []);
              }
              attrRows.forEach((a) => (attrByCode[a.point_code] = a));
            }

            progressEl.innerText = '⏳ Đang chuẩn bị dữ liệu (đã ẩn danh) cho bộ kiểm định...';

            const payloadPoints = points.map((p) => {
              const features = {};
              if (attrByCode[p.point_code]) {
                featureCodes.forEach((code) => {
                  const config = ScoringCore.CRITERIA_MAP[code];
                  if (!config) return;
                  const raw = ScoringCore.getRawValue(attrByCode[p.point_code], config);
                  if (raw !== null) {
                    features[code] = typeof raw === 'boolean' ? (raw ? 1 : 0) : raw;
                  }
                });
              }
              return {
                khong_dat: p.khong_dat,
                R: Number(p.diem_r),
                nhom_uu_tien: RESEARCH_GROUP_LABEL_TO_CODE[p.nhom_uu_tien] || null,
                features,
              };
            });

            if (window.userRole !== 'admin') {
              throw new Error('Chỉ Admin mới được phép chạy kiểm định thống kê.');
            }

            const result = await runStatsInBrowser({
              points: payloadPoints,
              alpha: 0.05,
              bootstrap_n: 2000,
              random_state: 42,
            }, (t) => { progressEl.innerText = '⏳ ' + t; });
            lastValidationResult = result;

            progressEl.innerText = '⏳ Đang lưu bằng chứng vào analysis_runs...';
            await saveValidationAnalysisRun(result, payloadPoints);

            renderValidationResult(result);
            progressEl.innerHTML = `✅ Hoàn tất (N=${result.metadata.n_points}, ${result.metadata.elapsed_seconds}s).`;
            showToast('success', 'Đã chạy kiểm chứng thống kê thành công!');
          } catch (err) {
            console.error('❌ Lỗi chạy kiểm chứng:', err);
            progressEl.innerHTML = `❌ Lỗi: ${err.message}`;
            showToast('error', 'Lỗi khi chạy kiểm chứng: ' + err.message);
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<i class="fa-solid fa-vial-circle-check"></i> CHẠY KIỂM CHỨNG THỐNG KÊ';
            }
          }
        }

        // MODULE 4: chạy stats_core.py trong trình duyệt (Pyodide, Web Worker) — không cần server.
        let statsWorker = null;
        function runStatsInBrowser(params, onProgress) {
          if (params.points.length < 10) {
            return Promise.reject(new Error('Cần tối thiểu 10 điểm để chạy kiểm định thống kê ổn định (nhận được ' + params.points.length + ').'));
          }
          if (!statsWorker) statsWorker = new Worker('stats-worker.js?v=20261112b', { type: 'module' });
          return new Promise((resolve, reject) => {
            const id = Date.now();
            statsWorker.onmessage = (e) => {
              const m = e.data;
              if (m.type === 'progress') onProgress && onProgress(m.text);
              else if (m.type === 'result' && m.id === id) resolve(m.result);
              else if (m.type === 'error' && m.id === id) reject(new Error(m.error));
            };
            statsWorker.onerror = (e) => reject(new Error(e.message || 'Worker lỗi'));
            statsWorker.postMessage({ id, params });
          });
        }

        async function saveValidationAnalysisRun(result, payloadPoints) {
          const checksumInput = JSON.stringify(
            payloadPoints
              .map((p) => [p.khong_dat, p.R])
              .sort((a, b) => a[1] - b[1])
          );
          const dataChecksum = fnv1aHash(checksumInput);

          const {
            data: { user },
          } = await supabaseClient.auth.getUser();

          const { error } = await supabaseClient.from('analysis_runs').insert({
            run_time: new Date().toISOString(),
            nguoi_thuc_hien: (user && user.email) || 'admin',
            mo_ta: 'Module 4 - Kiểm chứng thống kê bộ tiêu chí (χ²/logistic/ROC-AUC)',
            data_checksum: dataChecksum,
            n_diem: result.metadata.n_points,
            n_khong_dat: result.metadata.n_khong_dat,
            ket_qua_kiem_dinh: result,
            phien_ban_thu_vien: result.metadata.library_versions,
          });
          if (error) console.warn('⚠️ Không thể lưu analysis_run:', error.message);
        }

        function fmtOR(v) {
          return v === null || v === undefined ? '—' : Number(v).toFixed(2);
        }
        function fmtP(display) {
          return display || '—';
        }

        function renderValidationResult(result) {
          const container = document.getElementById('validation-content');
          if (!container) return;

          if (result.error) {
            container.innerHTML = `<p class="text-danger p-3">${result.error}</p>`;
            return;
          }

          const gc = result.group_comparison || {};
          const uni = result.logistic_univariate || {};
          const multi = result.logistic_multivariate || {};
          const roc = result.roc_auc || {};

          let html = `<div style="font-size:13px">`;

          // --- Metadata ---
          html += `<div class="kamet-summary-bar">
            <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
              N=${result.metadata.n_points} điểm · ${result.metadata.n_khong_dat} không đạt (${(result.metadata.ty_le_khong_dat * 100).toFixed(1)}%)
            </span>
            <span class="kamet-summary-chip" style="background:#eef;border:1px solid #99a;color:#334">
              Thư viện: scipy ${result.metadata.library_versions.scipy} · statsmodels ${result.metadata.library_versions.statsmodels} · sklearn ${result.metadata.library_versions.scikit_learn}
            </span>
          </div>`;

          // --- (a) Bảng χ²/Fisher ---
          html += `<h6 class="mt-3"><i class="fa-solid fa-table"></i> (a) So sánh tỷ lệ không đạt giữa các nhóm nguy cơ</h6>`;
          if (gc.crosstab) {
            const groupLabelVN = { thap: 'Thấp', tb: 'Trung bình', tb_cao: 'Trung bình-cao', cao: 'Ưu tiên cao' };
            let rows = gc.crosstab.groups
              .map((g, i) => {
                const [dat, khongDat] = gc.crosstab.observed[i];
                const total = dat + khongDat;
                const rate = total > 0 ? ((khongDat / total) * 100).toFixed(1) : '—';
                return `<tr><td>${groupLabelVN[g] || g}</td><td>${dat}</td><td>${khongDat}</td><td>${total}</td><td>${rate}%</td></tr>`;
              })
              .join('');
            html += `<table class="table table-sm table-bordered">
              <thead><tr><th>Nhóm</th><th>Đạt</th><th>Không đạt</th><th>Tổng</th><th>Tỷ lệ không đạt</th></tr></thead>
              <tbody>${rows}</tbody></table>`;
            if (gc.test) {
              html += `<p>Kiểm định: <b>${gc.test.method}</b> — thống kê=${fmtOR(gc.test.statistic)}, p=${fmtP(gc.test.p_display)}</p>`;
            }
            if (gc.trend_test && !gc.trend_test.error) {
              html += `<p>Cochran-Armitage trend test: thống kê=${fmtOR(gc.trend_test.statistic)}, p=${fmtP(gc.trend_test.p_display)}</p>`;
            }
            (gc.warnings || []).forEach((w) => {
              html += `<p class="kamet-diff-flag"><i class="fa-solid fa-triangle-exclamation"></i> ${w}</p>`;
            });
          } else {
            html += `<p class="text-muted">${(gc.warnings || []).join(' ')}</p>`;
          }

          html += renderValidationLogisticSection(uni, multi);
          html += renderValidationRocSection(roc);
          html += `</div>`;
          container.innerHTML = html;

          if (roc.roc) drawRocChart(roc.roc, roc.auc);
        }

        function renderValidationLogisticSection(uni, multi) {
          let html = `<h6 class="mt-3"><i class="fa-solid fa-chart-line"></i> (b) Hồi quy logistic</h6>`;

          html += `<p><b>Đơn biến (khong_dat ~ R):</b></p>`;
          if (uni.result) {
            html += `<table class="table table-sm table-bordered">
              <thead><tr><th>N (dùng/loại thiếu)</th><th>OR</th><th>KTC 95%</th><th>p</th><th>Pseudo-R²</th></tr></thead>
              <tbody><tr>
                <td>${uni.n_obs} / ${uni.n_dropped_missing}</td>
                <td>${fmtOR(uni.result.OR)}</td>
                <td>[${fmtOR(uni.result.OR_ci95[0])}, ${fmtOR(uni.result.OR_ci95[1])}]</td>
                <td>${fmtP(uni.result.p_display)}</td>
                <td>${fmtOR(uni.result.pseudo_r2_mcfadden)}</td>
              </tr></tbody></table>`;
          } else {
            html += `<p class="text-muted">${(uni.warnings || []).join(' ')}</p>`;
          }

          html += `<p><b>Đa biến (theo các tiêu chí đã chuẩn hóa có trọng số):</b></p>`;
          if (multi.result) {
            const rows = Object.keys(multi.result.variables)
              .map((code) => {
                const v = multi.result.variables[code];
                const vif =
                  multi.vif && multi.vif[code] !== undefined
                    ? Number(multi.vif[code]).toFixed(2)
                    : '—';
                return `<tr><td>${code}</td><td>${fmtOR(v.OR_adjusted)}</td><td>[${fmtOR(
                  v.OR_ci95[0]
                )}, ${fmtOR(v.OR_ci95[1])}]</td><td>${fmtP(v.p_display)}</td><td>${vif}</td></tr>`;
              })
              .join('');
            html += `<table class="table table-sm table-bordered">
              <thead><tr><th>Biến</th><th>OR hiệu chỉnh</th><th>KTC 95%</th><th>p</th><th>VIF</th></tr></thead>
              <tbody>${rows}</tbody></table>
              <p>N = ${multi.n_obs} (loại ${multi.n_dropped_missing} điểm thiếu biến) · Pseudo-R² = ${fmtOR(
              multi.result.pseudo_r2_mcfadden
            )}</p>`;
          } else {
            html += `<p class="text-muted">${(multi.warnings || []).join(' ')}</p>`;
          }
          (multi.warnings || []).forEach((w) => {
            html += `<p class="kamet-diff-flag"><i class="fa-solid fa-triangle-exclamation"></i> ${w}</p>`;
          });
          (uni.warnings || []).forEach((w) => {
            html += `<p class="kamet-diff-flag"><i class="fa-solid fa-triangle-exclamation"></i> ${w}</p>`;
          });

          return html;
        }

        function renderValidationRocSection(roc) {
          let html = `<h6 class="mt-3"><i class="fa-solid fa-chart-area"></i> (c) Khả năng phân biệt của thang điểm R</h6>`;

          if (!roc.auc) {
            html += `<p class="text-muted">${(roc.warnings || []).join(' ')}</p>`;
            return html;
          }

          html += `<div style="display:flex;gap:20px;flex-wrap:wrap">
            <div style="flex:1;min-width:280px">
              <canvas id="roc-chart-canvas" height="220"></canvas>
            </div>
            <div style="flex:1;min-width:280px">
              <p><b>AUC</b> = ${fmtOR(roc.auc.value)} (KTC 95% bootstrap: [${fmtOR(
            roc.auc.ci95[0]
          )}, ${fmtOR(roc.auc.ci95[1])}], n=${roc.auc.bootstrap_n_valid})</p>
              <p><b>Ngưỡng tối ưu (Youden's J)</b>: R = ${fmtOR(roc.youden.threshold)}</p>
              <table class="table table-sm table-bordered">
                <thead><tr><th></th><th>Giá trị</th><th>KTC 95%</th></tr></thead>
                <tbody>
                  <tr><td>Độ nhạy (Se)</td><td>${fmtOR(roc.youden.sensitivity)}</td><td>[${fmtOR(
            roc.youden.sensitivity_ci95[0]
          )}, ${fmtOR(roc.youden.sensitivity_ci95[1])}]</td></tr>
                  <tr><td>Độ đặc hiệu (Sp)</td><td>${fmtOR(roc.youden.specificity)}</td><td>[${fmtOR(
            roc.youden.specificity_ci95[0]
          )}, ${fmtOR(roc.youden.specificity_ci95[1])}]</td></tr>
                </tbody>
              </table>
              <p><b>Ma trận nhầm lẫn</b> (ngưỡng ${fmtOR(roc.confusion_matrix.threshold)}):</p>
              <table class="table table-sm table-bordered text-center">
                <thead><tr><th></th><th>Dự báo Không đạt</th><th>Dự báo Đạt</th></tr></thead>
                <tbody>
                  <tr><td>Thực tế Không đạt</td><td>TP=${roc.confusion_matrix.TP}</td><td>FN=${
            roc.confusion_matrix.FN
          }</td></tr>
                  <tr><td>Thực tế Đạt</td><td>FP=${roc.confusion_matrix.FP}</td><td>TN=${
            roc.confusion_matrix.TN
          }</td></tr>
                </tbody>
              </table>
              <p>Mann-Whitney U: R trung bình đạt=${fmtOR(
                roc.mann_whitney.R_mean_dat
              )} vs không đạt=${fmtOR(roc.mann_whitney.R_mean_khong_dat)}, p=${fmtP(
            roc.mann_whitney.p_display
          )}</p>
              <p style="font-size:11.5px;color:#888"><i class="fa-solid fa-circle-info"></i> Dữ liệu mất cân bằng lớp nhẹ — dùng AUC/Se/Sp làm chỉ số chính, không dùng accuracy.</p>
            </div>
          </div>`;
          (roc.warnings || []).forEach((w) => {
            html += `<p class="kamet-diff-flag"><i class="fa-solid fa-triangle-exclamation"></i> ${w}</p>`;
          });
          return html;
        }

        function drawRocChart(rocData, aucData) {
          const canvas = document.getElementById('roc-chart-canvas');
          if (!canvas) return;
          if (rocChartInstance) rocChartInstance.destroy();

          const points = rocData.fpr.map((f, i) => ({ x: f, y: rocData.tpr[i] }));
          rocChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: {
              datasets: [
                {
                  label: `ROC (AUC=${fmtOR(aucData.value)})`,
                  data: points,
                  showLine: true,
                  borderColor: '#008b99',
                  backgroundColor: 'rgba(0,139,153,0.1)',
                  pointRadius: 0,
                  borderWidth: 2,
                },
                {
                  label: 'Đường tham chiếu (ngẫu nhiên)',
                  data: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ],
                  showLine: true,
                  borderColor: '#ccc',
                  borderDash: [5, 5],
                  pointRadius: 0,
                  borderWidth: 1,
                },
              ],
            },
            options: {
              responsive: true,
              scales: {
                x: { title: { display: true, text: '1 - Độ đặc hiệu (FPR)' }, min: 0, max: 1 },
                y: { title: { display: true, text: 'Độ nhạy (TPR)' }, min: 0, max: 1 },
              },
              plugins: { title: { display: true, text: 'Đường cong ROC' } },
            },
          });
        }

        function exportValidationCSV() {
          if (!lastValidationResult) {
            return showToast('warning', 'Chưa có kết quả kiểm chứng để xuất. Hãy chạy trước.');
          }
          const r = lastValidationResult;
          let csv = 'Chỉ số,Giá trị\n';
          csv += `N điểm,${r.metadata.n_points}\n`;
          csv += `N không đạt,${r.metadata.n_khong_dat}\n`;
          csv += `Chi-square,${r.group_comparison.test ? r.group_comparison.test.statistic : ''}\n`;
          csv += `Chi-square p,${r.group_comparison.test ? r.group_comparison.test.p_value : ''}\n`;
          csv += `OR don bien,${r.logistic_univariate.result ? r.logistic_univariate.result.OR : ''}\n`;
          csv += `OR don bien p,${r.logistic_univariate.result ? r.logistic_univariate.result.p_value : ''}\n`;
          csv += `AUC,${r.roc_auc.auc ? r.roc_auc.auc.value : ''}\n`;
          csv += `AUC CI lower,${r.roc_auc.auc ? r.roc_auc.auc.ci95[0] : ''}\n`;
          csv += `AUC CI upper,${r.roc_auc.auc ? r.roc_auc.auc.ci95[1] : ''}\n`;
          csv += `Youden threshold,${r.roc_auc.youden ? r.roc_auc.youden.threshold : ''}\n`;
          csv += `Sensitivity,${r.roc_auc.youden ? r.roc_auc.youden.sensitivity : ''}\n`;
          csv += `Specificity,${r.roc_auc.youden ? r.roc_auc.youden.specificity : ''}\n`;

          const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `Kiem_chung_thong_ke_${new Date().toISOString().slice(0, 10)}.csv`;
          link.click();
          showToast('success', 'Đã xuất file CSV!');
        }

        async function exportValidationPDF() {
          if (!lastValidationResult) {
            return showToast('warning', 'Chưa có kết quả kiểm chứng để xuất. Hãy chạy trước.');
          }
          showToast('info', 'Đang tạo file PDF...');
          try {
            const element = document.getElementById('research-tab-kiemchung');
            const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = (canvas.height * pageWidth) / canvas.width;

            pdf.setFontSize(14);
            pdf.text('Kết quả kiểm chứng thống kê - Module 4', 10, 12);
            pdf.addImage(imgData, 'PNG', 0, 18, pageWidth, imgHeight);
            pdf.save(`Kiem_chung_thong_ke_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast('success', 'Đã xuất file PDF!');
          } catch (err) {
            console.error('Lỗi xuất PDF:', err);
            showToast('error', 'Lỗi khi xuất PDF: ' + err.message);
          }
        }

        window.onload = async () => {
          const {
            data: { session },
          } = await supabaseClient.auth.getSession();

          if (session) {
            // Nếu đã có session, nạp lại quyền hạn từ profiles
            const { data: profile } = await supabaseClient
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              window.userRole = profile.role;
              document.getElementById('login-overlay').style.display = 'none';
              applyPermissions(profile.role);
              init();
              return;
            }
          }
          // Nếu chưa đăng nhập hoặc có lỗi profile, hiện overlay login
          document.getElementById('login-overlay').style.display = 'flex';
        };
        async function handleLogout() {
          await supabaseClient.auth.signOut();
          location.reload(); // Tải lại trang để hiện lại màn hình Login
        }
        // Thêm vào cuối file JS (sau window.onload)
        // 1. Hàm ẩn/hiện mật khẩu
        function togglePassword(inputId) {
          const input = document.getElementById(inputId);
          const iconId =
            inputId === 'current-password'
              ? 'toggle-icon-current'
              : inputId === 'new-password'
              ? 'toggle-icon-new'
              : 'toggle-icon-confirm';
          const icon = document.getElementById(iconId);

          if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
          } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
          }
        }

        // 2. Hàm xử lý đổi mật khẩu chính
        async function processChange(e) {
          e.preventDefault();
          const newPw = document.getElementById('new-pw').value;
          const confirmPw = document.getElementById('confirm-pw').value;
          const msg = document.getElementById('pw-msg');
          const submitBtn = document.getElementById('submit-pw');

          // Kiểm tra khớp mật khẩu
          if (newPw !== confirmPw) {
            msg.style.color = '#ff4d4d';
            msg.innerText = '❌ Mật khẩu xác nhận không khớp!';
            return;
          }

          if (newPw.length < 6) {
            msg.style.color = '#ff4d4d';
            msg.innerText = '⚠️ Mật khẩu phải từ 6 ký tự.';
            return;
          }

          try {
            submitBtn.disabled = true;
            submitBtn.value = 'ĐANG LƯU...';

            const { error } = await supabaseClient.auth.updateUser({
              password: newPw,
            });
            if (error) throw error;

            // Thành công -> Đếm ngược 10s để Logout
            let timeLeft = 10;
            msg.style.color = '#00ff00';

            const timer = setInterval(() => {
              msg.innerHTML = `✅ Thành công! Đăng xuất sau <b>${timeLeft}s</b>`;
              timeLeft--;
              if (timeLeft < 0) {
                clearInterval(timer);
                handleLogout();
              }
            }, 1000);
          } catch (err) {
            msg.style.color = '#ff4d4d';
            msg.innerText = 'Lỗi: ' + err.message;
            submitBtn.disabled = false;
            submitBtn.value = 'Change Password';
          }
        }

        function openChangePasswordPage() {
          document.getElementById('change-password-overlay').style.display =
            'flex';
          document.getElementById('password-message').innerText = '';
        }
        // Hàm xử lý đổi mật khẩu (ĐÃ SỬA LỖI)
        async function handleChangePassword(event) {
          event.preventDefault();

          const currentPassword =
            document.getElementById('current-password').value;
          const newPassword = document.getElementById('new-password').value;
          const confirmPassword =
            document.getElementById('confirm-password').value;
          const messageElement = document.getElementById('password-message');

          // Kiểm tra mật khẩu mới
          if (newPassword !== confirmPassword) {
            messageElement.style.color = '#ff4d4d';
            messageElement.innerText = '❌ Mật khẩu xác nhận không khớp!';
            return;
          }

          if (newPassword.length < 6) {
            messageElement.style.color = '#ff4d4d';
            messageElement.innerText = '⚠️ Mật khẩu phải có ít nhất 6 ký tự!';
            return;
          }

          try {
            // Hiển thị trạng thái xử lý
            const submitBtn = document.querySelector(
              '.form input[type="submit"]'
            );
            submitBtn.value = 'Đang xử lý...';
            submitBtn.disabled = true;

            // 1. LẤY EMAIL HIỆN TẠI TỪ SESSION (SỬA LỖI TẠI ĐÂY)
            const {
              data: { user },
              error: userError,
            } = await supabaseClient.auth.getUser();
            if (userError || !user)
              throw new Error('Không thể lấy thông tin người dùng');

            const email = user.email;

            // 2. XÁC THỰC LẠI VỚI MẬT KHẨU HIỆN TẠI
            const { error: authError } =
              await supabaseClient.auth.signInWithPassword({
                email: email,
                password: currentPassword,
              });

            if (authError) throw new Error('Mật khẩu hiện tại không chính xác');

            // 3. CẬP NHẬT MẬT KHẨU MỚI
            const { error: updateError } = await supabaseClient.auth.updateUser(
              {
                password: newPassword,
              }
            );

            if (updateError) throw updateError;

            // 4. THÔNG BÁO THÀNH CÔNG VÀ ĐẾM NGƯỢC
            messageElement.style.color = '#f26522';
            messageElement.innerHTML =
              '✅ Đổi mật khẩu thành công! Tự động đăng xuất sau <span id="countdown">5</span> giây...';

            // Đếm ngược và đăng xuất
            let countdown = 5;
            const countdownElement = document.getElementById('countdown');

            const timer = setInterval(() => {
              countdown--;
              countdownElement.textContent = countdown;

              if (countdown <= 0) {
                clearInterval(timer);
                handleLogout();
              }
            }, 1000);
          } catch (error) {
            console.error('Lỗi đổi mật khẩu:', error);
            messageElement.style.color = '#f26522';
            messageElement.innerText = `Lỗi: ${
              error.message || 'Có lỗi xảy ra'
            }`;

            // Reset nút submit
            const submitBtn = document.querySelector(
              '.form input[type="submit"]'
            );
            submitBtn.value = 'Change Password';
            submitBtn.disabled = false;
          }
        }
        // Hàm toggle menu tài khoản
        function toggleAccountMenu() {
          const menu = document.getElementById('account-menu');
          const header = document.querySelector('.collapsible');

          // Thêm/loại bỏ class "show"
          menu.classList.toggle('show');
          header.classList.toggle('show');
        }

        // Đảm bảo menu ẩn khi load trang
        document.addEventListener('DOMContentLoaded', () => {
          const menu = document.getElementById('account-menu');
          menu.classList.remove('show');
          document.querySelector('.collapsible').classList.remove('show');
        });
        function parseAIAnalysis(text) {
          if (!text || typeof text !== 'string') return [];

          let cleanText = text.replace(/\r\n/g, '\n').trim();
          const sections = [];
          let actionSection = null; // Biến tạm để giữ phần Hành động

          // 1. TÌM PHẦN [HÀNH ĐỘNG] NHƯNG CHƯA ĐẨY VÀO MẢNG NGAY
          const actionMatch = cleanText.match(
            /\[HÀNH ĐỘNG\]:\s*(\{[\s\S]*?\})/
          );
          if (actionMatch) {
            try {
              let jsonStr = actionMatch[1]
                .replace(/'/g, '"')
                .replace(/(\w+)(?=\s*:)/g, '"$1"');

              const actionObj = JSON.parse(jsonStr);
              actionSection = {
                title: 'HÀNH ĐỘNG KHUYẾN NGHỊ',
                type: 'action_timeline',
                data: actionObj,
              };

              // Xóa khỏi text chính để các bước sau không xử lý lại
              cleanText = cleanText.replace(actionMatch[0], '').trim();
            } catch (e) {
              console.warn('Lỗi parse JSON hành động:', e);
            }
          }

          // 2. XỬ LÝ CÁC PHẦN PHÂN TÍCH (ĐẨY VÀO MẢNG TRƯỚC)
          const rawSections = cleanText.split(
            /(?=\n\d+\.|\n\[.*?\]|^ \d+\.|^\d+\.|^\[.*?\])/g
          );

          for (let sec of rawSections) {
            const trimmedSec = sec.trim();
            if (!trimmedSec) continue;

            const lines = trimmedSec.split('\n');
            let rawTitle = lines[0].trim();
            let rawBody = lines.slice(1).join('\n').trim();

            let finalTitle = /^(\d+\.|\[.*?\])/.test(rawTitle) ? rawTitle : '';
            if (!finalTitle) rawBody = rawTitle + '\n' + rawBody;

            const currentSection = {
              title: finalTitle.replace(/\*\*/g, '').trim(),
              type: 'standard',
              content: [],
            };

            const bodyLines = rawBody
              .split('\n')
              .filter((l) => l.trim().length > 0);
            for (let line of bodyLines) {
              let processedText = line.trim();

              processedText = processedText
                .replace(/\[(.*?)\]/g, '<b>[$1]</b>')
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(
                  /(Tăng)/g,
                  '<span class="trend-highlight trend-increase">$1</span>'
                )
                .replace(
                  /(Giảm)/g,
                  '<span class="trend-highlight trend-decrease">$1</span>'
                )
                .replace(
                  /(\d+[\.,]?\d*\s?(mg\/L|NTU|%|mẫu|m|°C))/gi,
                  '<strong>$1</strong>'
                );

              currentSection.content.push({
                type: /^[•\-+*→]/.test(processedText) ? 'item' : 'paragraph',
                text: processedText.replace(/^[•\-+*→]\s*/, ''),
              });
            }
            if (currentSection.content.length > 0)
              sections.push(currentSection);
          }

          // 3. CUỐI CÙNG MỚI ĐẨY HÀNH ĐỘNG VÀO (ĐỂ NÓ NẰM DƯỚI CÙNG)
          if (actionSection) {
            sections.push(actionSection);
          }

          return sections;
        }
        async function loadAIInsights() {
          console.group('🚀 LOAD AI INSIGHTS');
          try {
            const { data, error } = await supabaseClient
              .from('ai_daily_insights')
              .select('*')
              .order('prediction_date', { ascending: false })
              .limit(1);

            const container = document.getElementById('ai-content');
            if (error || !data || data.length === 0) {
              if (container)
                container.innerHTML =
                  '<div style="text-align:center; color:#999; padding:20px;">Chưa có nhận định hôm nay</div>';
              return;
            }

            const item = data[0];
            const sections = parseAIAnalysis(item.analysis_text);

            // Header: Ngày & Mức độ rủi ro
            let html = `
      <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ddd;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
           <small style="color:#666; font-weight:600;">📅 ${
             item.prediction_date
           }</small>
           <span class="risk-badge ${
             item.risk_level === 'Cao' ? 'high' : 'low'
           }">${item.risk_level}</span>
        </div>
        <div style="font-size: 0.85rem; color: #555; margin-top: 5px;">
           <i class="fa-solid fa-cloud-sun"></i> ${
             item.weather_info?.desc || 'N/A'
           } | ${item.weather_info?.temp || 'N/A'}°C
        </div>
      </div>
    `;

            // Render từng Section
            sections.forEach((sec) => {
              if (sec.type === 'action_timeline') {
                // --- VẼ TIMELINE HÀNH ĐỘNG ---
                html += `<div style="margin: 20px 0 10px; border-left: 4px solid #00796b; padding-left: 12px;text-align:justify">
                    <b style="color: #00796b; text-transform: uppercase; font-size: 0.9rem;">${sec.title}</b>
                 </div>`;

                for (let [timeframe, tasks] of Object.entries(sec.data)) {
                  let color = '#555',
                    bgColor = '#f9f9f9';
                  if (timeframe.includes('NGAY LẬP TỨC')) {
                    color = '#d32f2f';
                    bgColor = '#fff5f5';
                  } else if (timeframe.includes('NGẮN HẠN')) {
                    color = '#ef6c00';
                    bgColor = '#fff8f1';
                  } else if (timeframe.includes('TRUNG HẠN')) {
                    color = '#1976d2';
                    bgColor = '#f0f7ff';
                  }

                  html += `
            <div style="margin-bottom: 12px; padding: 12px; background: ${bgColor}; border-radius: 8px; border: 1px solid ${color}33;">
              <div style="color: ${color}; font-weight: bold; font-size: 0.8rem; margin-bottom: 8px; display: flex; align-items: center; text-transform: uppercase;">
                <i class="fa-solid fa-bolt-lightning" style="margin-right: 8px;"></i> ${timeframe}
              </div>
              <ul style="margin: 0; padding-left: 18px; color: #333; font-size: 0.85rem; line-height: 1.6;text-align: justify;">
                ${tasks
                  .map((task) => `<li style="margin-bottom: 4px;">${task}</li>`)
                  .join('')}
              </ul>
            </div>
          `;
                }
              } else {
                // --- VẼ NHẬN ĐỊNH TIÊU CHUẨN ---
                if (sec.title) {
                  const isBracket = /^\[.*?\]/.test(sec.title);
                  const titleStyle = isBracket
                    ? 'color:#00796b; font-weight:bold; margin-top:18px;'
                    : 'font-weight:700; margin-top:15px; color:#333;';
                  html += `<div style="${titleStyle} margin-bottom:10px; font-size:0.95rem;">${sec.title}</div>`;
                }

                sec.content.forEach((line) => {
                  const isItem = line.type === 'item';
                  const style = `display: block; margin-bottom: 8px; line-height: 1.6; text-align: justify; font-size: 0.88rem; color:#444; ${
                    isItem ? 'padding-left: 18px; position: relative;' : ''
                  }`;
                  const bullet = isItem
                    ? `<span style="position:absolute; left:0; color:#00796b;">${
                        /^[→]/.test(line.text) ? '' : '•'
                      }</span>`
                    : '';
                  html += `<div style="${style}">${bullet}${line.text}</div>`;
                });
              }
            });

            container.innerHTML = html;

            // CẬP NHẬT ZONE TAGS (Phường bị ảnh hưởng)
            const zoneContainer = document.getElementById('zone-tags');
            if (zoneContainer && item.affected_wards) {
              const wards = Array.isArray(item.affected_wards)
                ? item.affected_wards
                : item.affected_wards.split(/[,\n]/).filter((w) => w.trim());
              zoneContainer.innerHTML = wards
                .map((w) => `<span class="zone-badge">${w.trim()}</span>`)
                .join('');
            }
          } catch (err) {
            console.error('💥 Lỗi loadAIInsights:', err);
            if (document.getElementById('ai-content')) {
              document.getElementById('ai-content').innerHTML =
                '<div style="color:red; font-size:0.8rem; padding:10px;">Lỗi xử lý dữ liệu AI</div>';
            }
          } finally {
            console.groupEnd();
          }
        }

        // Hàm đóng mở Modal
        function toggleAIModal() {
          const modal = document.getElementById('ai-modal');

          if (modal.style.display === 'none' || modal.style.display === '') {
            modal.style.display = 'block';
            loadAIInsights(); // Tải dữ liệu khi mở
          } else {
            modal.style.display = 'none';
          }
        }

        let alertZoneLayer = null; // Chứa Polygons (Phường)
        let alertPointLayer = L.layerGroup(); // Chứa Markers (Cơ sở)
        let isAlertActive = false;

        async function toggleRiskLayer() {
          const btn = document.querySelector('.btn-activate-layer');
          if (!window.hcmGeoJSON)
            return showToast('error', 'Chưa tải xong bản đồ.');

          // --- TRƯỜNG HỢP TẮT CẢNH BÁO ---
          if (isAlertActive) {
            if (alertZoneLayer) map.removeLayer(alertZoneLayer);
            if (alertPointLayer) {
              alertPointLayer.clearLayers();
              map.removeLayer(alertPointLayer);
            }
            // Gỡ bỏ lớp Lưới lục giác khi tắt
            if (hexLayer) {
              map.removeLayer(hexLayer);
            }
            btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> CẢNH BÁO';
            btn.classList.remove('active-alert');
            isAlertActive = false;
            return;
          }

          // --- TRƯỜNG HỢP BẬT CẢNH BÁO ---
          try {
            const { data: insight, error: insightError } = await supabaseClient
              .from('ai_daily_insights')
              .select('*')
              .order('prediction_date', { ascending: false })
              .limit(1)
              .single();

            if (insightError || !insight)
              return showToast('warning', 'Thiếu dữ liệu phân tích.');

            // Chuyển danh sách địa bàn thành chữ thường để so khớp chính xác
            const rawNames = insight.affected_wards || [];
            const cleanNames = rawNames.map((n) =>
              String(n).toLowerCase().trim()
            );

            // Lấy tọa độ các cơ sở/điểm rủi ro
            const { data: locations } = await supabaseClient
              .from('risk_locations')
              .select('*');

            let matchedWardNames = new Set();

            // Khởi tạo Layer Group cho Marker nếu chưa có
            if (!alertPointLayer) alertPointLayer = L.layerGroup();
            alertPointLayer.clearLayers();

            const aiAnalysis =
              insight.analysis_text || 'Chưa có nhận định chuyên sâu.';

            // --- TẦNG 1: VẼ POLYGON (PHƯỜNG) ---
            alertZoneLayer = L.geoJSON(window.hcmGeoJSON, {
              filter: function (feature) {
                if (!feature.properties?.tenXa) return false;
                const name = feature.properties.tenXa.trim().toLowerCase();
                const isMatched = cleanNames.includes(name);
                if (isMatched) matchedWardNames.add(name);
                return isMatched;
              },
              style: {
                fillColor: '#f26522',
                weight: 2,
                opacity: 1,
                color: '#ffffff',
                fillOpacity: 0.5,
              },
              onEachFeature: function (feature, layer) {
                const p = feature.properties;
                const density =
                  p.dienTich > 0 ? (p.danSo / p.dienTich).toFixed(0) : 0;

                // Giữ nguyên Popup Phường "Đẹp" của sếp
                const popupContent = `
            <div class="risk-popup-container">
                <div class="risk-popup-header">
                    <span class="risk-label">CAO</span>
                    <b>${p.tenXa.toUpperCase()}</b>
                </div>
                <div class="risk-popup-body">
                    <table class="risk-info-table">
                        <tr><td><i class="fa-solid fa-users"></i> Dân số:</td><td><b>${p.danSo.toLocaleString()}</b> người</td></tr>
                        <tr><td><i class="fa-solid fa-vector-square"></i> Diện tích:</td><td><b>${
                          p.dienTich
                        }</b> km²</td></tr>
                        <tr><td><i class="fa-solid fa-chart-area"></i> Mật độ:</td><td><b>${density}</b> người/km²</td></tr>
                    </table>
                    <hr class="popup-divider">
                    <details class="ai-details-toggle">
                        <summary><b><i class="fa-brands fa-openai"></i> HCDC WebGIS</b> More...</summary>
                        <div class="ai-text-content">
                            ${aiAnalysis.replace(/\n/g, '<br>')}
                        </div>
                    </details>
                </div>
            </div>
        `;
                layer.bindPopup(popupContent, { maxWidth: 350 });
              },
            }).addTo(map);

            // --- TẦNG 2: VẼ MARKER (CƠ SỞ) ---
            // Hàm chuẩn hóa tên tại chỗ để đảm bảo khớp tuyệt đối
            const sanitize = (name) =>
              (name || '')
                .toString()
                .toLowerCase()
                .replace(/^(phường|phuong|quận|quan|p\.|q\.)\s+/g, '')
                .trim();

            const sanitizedAI = cleanNames.map((n) => sanitize(n));
            console.log('🤖 Lõi danh sách AI dự báo:', sanitizedAI);

            if (locations) {
              locations.forEach((loc) => {
                // So khớp dựa trên cả mã phường và tên cơ sở đã chuẩn hóa
                const locWard = sanitize(loc.maphuong);
                const locName = sanitize(loc.name);

                // Nếu cơ sở thuộc phường AI báo HOẶC tên cơ sở khớp trực tiếp với AI báo
                if (
                  (sanitizedAI.includes(locWard) ||
                    sanitizedAI.includes(locName)) &&
                  loc.lat &&
                  loc.lng
                ) {
                  console.log(
                    `✅ Khớp cơ sở rủi ro: ${loc.name} (${loc.lat}, ${loc.lng})`
                  );

                  const marker = L.marker([loc.lat, loc.lng], {
                    icon: L.divIcon({
                      className: 'risk-marker-pulse',
                      html: `<div class="pulse-red"><i class="fa-solid fa-triangle-exclamation"></i></div>`,
                      iconSize: [30, 30],
                    }),
                  }).bindPopup(`
                            <div style="text-align:justify;">
                                <b style="color:#e74c3c;">⚠️ VỊ TRÍ RỦI RO</b><br>
                                <b>${loc.name}</b><br>
                                <small>Địa bàn: ${
                                  loc.maphuong || 'Đang cập nhật'
                                }</small><br>
                                <small>Loại hình: ${loc.type}</small>
                            </div>
                        `);
                  marker.addTo(alertPointLayer);
                }
              });
            }

            alertPointLayer.addTo(map);

            // --- CÁCH TÍNH BOUNDS AN TOÀN TUYỆT ĐỐI ---
            let bounds = L.latLngBounds();
            let hasValidData = false;

            // 1. KIỂM TRA LỚP PHƯỜNG (Tầng vùng)
            if (alertZoneLayer && alertZoneLayer.getLayers().length > 0) {
              bounds.extend(alertZoneLayer.getBounds());
              hasValidData = true;
            }

            // 2. KIỂM TRA LỚP MARKER (Tầng điểm)
            if (alertPointLayer && alertPointLayer.getLayers().length > 0) {
              alertPointLayer.eachLayer((layer) => {
                if (layer.getLatLng) bounds.extend(layer.getLatLng());
              });
              hasValidData = true;
            }

            // --- XỬ LÝ KẾT QUẢ CUỐI CÙNG ---
            if (hasValidData) {
              // Zoom bản đồ một cách mượt mà
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
              await loadRiskHexGrid();
              // Cập nhật giao diện nút bấm
              btn.innerHTML =
                '<i class="fa-solid fa-circle-stop"></i> TẮT CẢNH BÁO';
              btn.classList.add('active-alert');
              isAlertActive = true;

              // Thông báo trạng thái thông minh cho người dùng
              const wardCount = matchedWardNames.size;
              const pointCount = alertPointLayer.getLayers().length;

              if (pointCount > 0) {
                showToast(
                  'warning',
                  `Xác định rủi ro tại ${wardCount} phường và ${pointCount} điểm cơ sở.`
                );
              } else {
                showToast(
                  'info',
                  `Phát hiện rủi ro tại ${wardCount} phường (Chưa có dữ liệu điểm cụ thể).`
                );
              }
            } else {
              // Chỉ báo lỗi khi AI báo tên hoàn toàn "lạ" không có trên bản đồ
              showToast(
                'error',
                'Dữ liệu AI không khớp với ranh giới hành chính hiện tại.'
              );
              console.warn('⚠️ Không tìm thấy khớp cho:', sanitizedAI);
            }
          } catch (err) {
            console.error('Lỗi khi bật lớp cảnh báo:', err);
            showToast('error', 'Có lỗi xảy ra khi xử lý dữ liệu bản đồ.');
          }
        }

        async function loadRiskHexGrid() {
          showToast(
            'info',
            'Đang dựng lưới phân tích rủi ro đa biến (Sentinel 2.0)...'
          );

          // 1. Truy vấn dữ liệu từ Materialized View
          const { data, error } = await supabaseClient
            .from('mv_risk_hexagons')
            .select('*');

          if (error) {
            console.error('Lỗi lấy lưới rủi ro:', error);
            showToast('error', 'Không thể tải lưới rủi ro.');
            return;
          }

          // 2. Dọn dẹp lớp cũ nếu đã tồn tại
          if (hexLayer) map.removeLayer(hexLayer);

          // 3. Khởi tạo lớp GeoJSON với Logic hiển thị thông minh
          hexLayer = L.geoJson(
            data.map((d) => ({
              type: 'Feature',
              geometry: d.geojson,
              properties: {
                score: d.risk_score,
                cases: d.case_count,
                water: d.water_fail_count,
                params: d.failed_params, // Nhận thông số lỗi từ SQL (Clo dư, pH, E.coli...)
              },
            })),
            {
              style: (feature) => {
                const p = feature.properties;
                // LOGIC VIỀN CẢNH BÁO: Ca bệnh > 0 nhưng mẫu nước lỗi = 0 (Cần tái kiểm tra)
                const isContradiction = p.cases > 0 && p.water === 0;

                return {
                  fillColor:
                    p.score > 5
                      ? '#d73027' // Rủi ro rất cao (Đỏ đậm)
                      : p.score > 2
                      ? '#f26522' // Rủi ro trung bình (Cam)
                      : '#fee08b', // Rủi ro thấp (Vàng)
                  fillOpacity: 0.6,
                  weight: isContradiction ? 3 : 0.8, // Viền dày 3px nếu có mâu thuẫn dữ liệu
                  color: isContradiction ? '#f26522' : '#fff', // Viền xanh Neon nếu mâu thuẫn, trắng nếu thường
                  dashArray: isContradiction ? '0' : '3', // Viền liền nếu mâu thuẫn để gây chú ý
                };
              },
              onEachFeature: (f, l) => {
                const p = f.properties;

                // Logic hiển thị nhãn cảnh báo mâu thuẫn trong Popup
                const alertBadge =
                  p.cases > 0 && p.water === 0
                    ? `<div style="background:#f26522; color:#eee; padding:2px 5px; font-size:10px; border-radius:3px; margin-bottom:5px; text-align:center;">
                      ❗️GỢI Ý KHU VỰC GIÁM SÁT LẤY MẪU
                       </div>`
                    : '';

                // Xây dựng HTML cho danh sách thông số lỗi
                const paramHtml =
                  p.water > 0
                    ? `<div style="margin-top:8px; padding:8px; background:#fff3f3; border-radius:4px; border-left:4px solid #d73027;">
                        <small><b>Thông số không đạt:</b></small><br>
                        <span style="color:#d73027; font-size:12px;">${p.params}</span>
                       </div>`
                    : `<div style="margin-top:8px; padding:5px; background:#f0f9f0; border-radius:4px;">
                        <small style="color:#008b99;">✔️ Thông số giám sát hiện đang đạt chuẩn</small>
                       </div>`;

                l.bindPopup(`
                    <div style="min-width:220px;">
                        ${alertBadge}
                        <div style="font-weight:bold; border-bottom:2px solid #eee; margin-bottom:10px; padding-bottom:5px; color:#2c3e50;">
                          🛑 Hexagonal Risk Grid
                        </div>
                        
                        <table style="width:100%; font-size:13px;">
                            <tr>
                                <td>Cas tiêu chảy (14 ngày):</td>
                                <td style="text-align:right;"><b style="color:#d73027; font-size:15px;">${
                                  p.cases
                                }</b></td>
                            </tr>
                            <tr>
                                <td>Mẫu nước không đạt:</td>
                                <td style="text-align:right;"><b style="color:#2980b9;">${
                                  p.water
                                }</b></td>
                            </tr>
                        </table>
                        ${paramHtml}
                        <div style="margin-top:12px; padding-top:8px; border-top:1px dashed #ccc; display:flex; justify-content:space-between; align-items:center;">
                          <span style="font-size:11px; color:#555; cursor:help; border-bottom: 1px dotted #999;" 
          title="Calculation weights: Water quality 0.7 - Diarrhea cases 0.3">
        Sentinel Score:
    </span>
    <b style="color:#2c3e50; font-size:15px; letter-spacing: 0.5px;">
        ${p.score.toFixed(1)}
    </b>
                        </div>
                        <div style="font-size:8px; color:#95a5a6; text-align:right; font-style:italic; margin-top:2px;">
    (Risk of water quality and diarrhea cases)
</div>
                    </div>
                `);
              },
            }
          ).addTo(map);

          showToast('success', 'Đã cập nhật lưới rủi ro Sentinel mới nhất.');
        }
        // ================================================================
        // 1. KHAI BÁO BIẾN TOÀN CỤC (Đặt ở đầu Script)
        // ================================================================
        var isOptimalActive = isOptimalActive || false;
        var optimalLayerGroup =
          optimalLayerGroup || L.featureGroup().addTo(map);

        // ================================================================
        // 2. KHỞI TẠO HỆ THỐNG (Gắn sự kiện khi load trang)
        // ================================================================
        document.addEventListener('DOMContentLoaded', function () {
          console.log('✅ Sentinel Optimization System Initialized');

          // === KHỞI TẠO SLIDER ===
          const quotaSlider = document.getElementById('opt-quota');
          const quotaLabel = document.getElementById('lbl-quota');
          if (quotaSlider && quotaLabel) {
            quotaSlider.oninput = function () {
              quotaLabel.textContent = this.value;
            };
          }

          const epiSlider = document.getElementById('opt-epi-weight');
          const epiLabel = document.getElementById('lbl-epi');
          if (epiSlider && epiLabel) {
            epiSlider.oninput = function () {
              epiLabel.textContent = this.value + '%';
            };
          }

          // === CHỌN TẤT CẢ PHƯỜNG ===
          const chkAll = document.getElementById('chk-all-wards');
          if (chkAll) {
            chkAll.addEventListener('change', function () {
              const isChecked = this.checked;
              document.querySelectorAll('.ward-chk').forEach((chk) => {
                chk.checked = isChecked;
              });
            });
          }

          // === GÁN SỰ KIỆN CHO NÚT THỰC THI ===
          const btnExecute = document.getElementById('btn-execute-opt');
          if (btnExecute) {
            btnExecute.onclick = executeOptimization;
          }

          console.log('🎛️ All modal controls initialized successfully');
        });

        // ================================================================
        // 3. ĐIỀU KHIỂN GIAO DIỆN (Modal & Toggle Layer)
        // ================================================================
        async function showOptimalPoints() {
          const btnOptimal = document.getElementById('btn-goiy');
          const modal = document.getElementById('modal-optimization');

          // NẾU ĐANG BẬT -> TẮT
          if (isOptimalActive) {
            optimalLayerGroup.clearLayers();
            if (map.hasLayer(optimalLayerGroup))
              map.removeLayer(optimalLayerGroup);

            btnOptimal.innerHTML =
              '<i class="fa-solid fa-wand-magic-sparkles"></i> GỢI Ý';
            btnOptimal.classList.remove('active-alert'); // Trở về màu xanh gốc
            isOptimalActive = false;
            showToast('info', 'Đã tắt Gợi ý các vị trí lấy mẫu');
            return;
          }

          // NẾU ĐANG TẮT -> MỞ MODAL CẤU HÌNH
          if (modal) {
            modal.style.display = 'block';
            const listContainer = document.getElementById('ward-list-items');
            if (listContainer && listContainer.children.length === 0) {
              await loadWardSelector();
            }
          }
        }

        // Hàm nạp danh mục phường
        async function loadWardSelector() {
          console.log('📦 Đang nạp danh mục hành chính...');
          const { data, error } = await supabaseClient
            .from('hcm_ward_stats')
            .select('maXa, tenXa')
            .order('tenXa');

          if (error) return console.error('Lỗi DB:', error.message);

          const container = document.getElementById('ward-list-items');
          if (container) {
            container.innerHTML = data
              .map(
                (w) => `
            <label class="check-item">
                <input type="checkbox" class="ward-chk" value="${w.maXa}"> ${w.tenXa}
            </label>
        `
              )
              .join('');
          }
        }

        // Bộ lọc tìm kiếm phường
        function filterWards() {
          let input = document
            .getElementById('ward-search')
            .value.toLowerCase();
          let items = document.querySelectorAll('#ward-list-items .check-item');
          items.forEach((item) => {
            item.style.display = item.innerText.toLowerCase().includes(input)
              ? 'block'
              : 'none';
          });
        }

        // ================================================================
        // 4. HÀM THỰC THI CHÍNH (Xử lý dữ liệu & Vẽ Marker)
        // ================================================================
        async function executeOptimization() {
          console.group('🚀 SENTINEL V5: ADVANCED OPTIMIZATION');

          const btnOptimal = document.getElementById('btn-goiy');
          const modal = document.getElementById('modal-optimization');

          try {
            // 1. THU THẬP THAM SỐ TỪ MODAL (Ép kiểu chặt chẽ)
            const quotaInput = document.getElementById('opt-quota');
            const quota = quotaInput ? parseInt(quotaInput.value) : 261;

            const epiWeightInput = document.getElementById('opt-epi-weight');
            const epiWeight = epiWeightInput
              ? parseFloat(epiWeightInput.value) / 100
              : 0.3;

            // Lấy danh sách phường đã chọn
            const selectedWards = Array.from(
              document.querySelectorAll('.ward-chk:checked')
            ).map((chk) => chk.value);

            // Lấy loại rủi ro (Bệnh viện, Trường học...)
            const riskTypes = Array.from(
              document.querySelectorAll('.risk-type-chk:checked')
            ).map((chk) => chk.value);

            // Tham số nâng cao (Boolean)
            const blindSpots =
              document.getElementById('opt-blind-spots')?.checked || false;
            const longTime =
              document.getElementById('opt-long-time')?.checked || false;

            // Kiểm tra đầu vào tối thiểu
            if (selectedWards.length === 0) {
              showToast(
                'warning',
                'Sếp ơi, chọn ít nhất một Phường/Xã đã nhé!'
              );
              console.groupEnd();
              return;
            }

            console.log('📤 Đang gửi tham số sang Sentinel V5:', {
              in_wards: selectedWards,
              in_quota: quota,
              in_risk_types: riskTypes,
            });

            // Đóng modal và thông báo bắt đầu xử lý
            if (modal) modal.style.display = 'none';
            showToast('info', 'Hệ thống đang tính toán vị trí tối ưu...');

            // 2. GỌI RPC (Sử dụng V5 để khớp tham số in_...)
            const { data, error } = await supabaseClient.rpc(
              'get_optimized_sampling_points_v5',
              {
                in_wards: selectedWards,
                in_quota: quota,
                in_epi_weight: epiWeight,
                in_risk_types: riskTypes,
                in_use_blind_spots: blindSpots,
                in_use_long_time: longTime,
              }
            );

            if (error) throw error;
            currentOptimalData = data; // LƯU DỮ LIỆU VÀO ĐÂY ĐỂ XUẤT EXCEL
            console.log(`✅ Đã lưu ${data.length} điểm để sẵn sàng xuất Excel`);

            if (!data || data.length === 0) {
              showToast(
                'warning',
                'Không tìm thấy điểm nào phù hợp. Sếp kiểm tra lại ranh giới phường nhé!'
              );
              console.groupEnd();
              return;
            }

            console.log(`✅ Thành công! Trả về ${data.length} điểm.`);

            // 3. LÀM SẠCH VÀ VẼ LÊN BẢN ĐỒ
            optimalLayerGroup.clearLayers();
            optimalLayerGroup.addTo(map);

            data.forEach((item) => {
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lng);
              const score = parseFloat(item.final_score || 0);

              if (isNaN(lat) || isNaN(lng)) return;

              // Phân loại mức độ rủi ro & Màu sắc
              // THAY THẾ TOÀN BỘ KHỐI PHÂN LOẠI
              const reason = item.reason;
              let riskLabel, riskColor, riskDetail;

              if (reason === '🔥 TRỌNG ĐIỂM NGUY CƠ') {
                riskLabel = 'RẤT CAO';
                riskColor = '#c0392b';
                riskDetail = 'Trọng điểm rủi ro hoặc vùng mù giám sát.';
              } else {
                // "🛡️ GIÁM SÁT ĐỊNH KỲ"
                // Phân nhánh phụ dựa trên score để chi tiết hơn
                if (score > 100) {
                  riskLabel = 'TRUNG BÌNH';
                  riskColor = '#f1c40f';
                  riskDetail = 'Khu vực dân cư rủi ro trung bình.';
                } else {
                  riskLabel = 'THẤP';
                  riskColor = '#27ae60';
                  riskDetail = 'Giám sát định kỳ.';
                }
              }

              // Chọn Icon theo loại hình rủi ro
              const type = (item.location_type || '').toLowerCase();
              let iconClass = 'fa-droplet';
              if (type.includes('hospital') || type.includes('clinic'))
                iconClass = 'fa-hospital';
              else if (type.includes('school')) iconClass = 'fa-school';
              else if (type.includes('waste') || type.includes('landfill'))
                iconClass = 'fa-trash-can';

              // Tạo Marker với CSS Pulse Effect
              const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                  className: 'custom-sampling-marker',
                  html: `
                        <div class="marker-outer" style="box-shadow: 0 0 0 4px ${riskColor}33;">
                            <div class="marker-inner" style="background-color: ${riskColor};">
                                <i class="fa-solid ${iconClass}" style="font-size: 11px;"></i>
                            </div>
                        </div>
                    `,
                  iconSize: [30, 30],
                  iconAnchor: [15, 15],
                  popupAnchor: [0, -15],
                }),
              }).bindPopup(`
                <div style="min-width: 240px;">
                    <div style="background:${riskColor}; color:white; padding:10px; text-align:center; font-weight:bold; border-radius:6px 6px 0 0;">
                        🚨 RỦI RO: ${riskLabel}
                    </div>
                    <div style="padding:14px; background:#fff; border:1px solid #eee; border-top:none; border-radius:0 0 6px 6px;">
                        <p style="margin:0 0 8px;"><b>Đơn vị:</b> ${
                          item.ward_name
                        }</p>
                        <p style="margin:0 0 12px; font-size:12px; color:#666;">Chỉ số rủi ro: <b>${score.toFixed(
                          1
                        )}</b></p>
                        <p style="margin:0 0 8px;"><b>Lý do:</b> <i style="font-size:12px;">${
                          item.reason
                        }</i></p>
                                                
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
                           target="_blank" 
                           style="display:block; text-align:center; background:${riskColor}; color:white; padding:10px; border-radius:6px; text-decoration:none; font-weight:400; font-size:12px;">
                           <i class="fa-solid fa-location-arrow"></i> DẪN ĐƯỜNG GOOGLE MAPS
                        </a>
                    </div>
                </div>
            `);

              marker.addTo(optimalLayerGroup);
            });

            // 4. ZOOM VÀ CẬP NHẬT TRẠNG THÁI NÚT
            const bounds = optimalLayerGroup.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
            }

            if (btnOptimal) {
              btnOptimal.innerHTML =
                '<i class="fa-solid fa-circle-stop"></i> TẮT GỢI Ý';
              btnOptimal.classList.add('active-alert');
            }

            isOptimalActive = true;
            showToast('success', `Hệ thống đã phân bổ ${data.length} vị trí.`);
          } catch (err) {
            console.error('💥 Lỗi Sentinel:', err);
            showToast('error', 'Không thể thực thi tối ưu hóa: ' + err.message);
          } finally {
            console.groupEnd();
          }
        }
        function closeOptimalModal() {
          const modal = document.getElementById('modal-optimization');
          if (modal) modal.style.display = 'none';
        }
        async function handleAdminSync() {
          // 1. Hiện thông báo yêu cầu mật khẩu
          const password = prompt(
            'HỆ THỐNG QUẢN TRỊ HCDC\nVui lòng nhập mật khẩu xác thực để đồng bộ địa chỉ:'
          );

          // 2. Kiểm tra mật khẩu
          if (password === null) return; // Người dùng nhấn Cancel

          if (password === '123456@PhamAnh') {
            showToast(
              'success',
              'Xác thực thành công. Bắt đầu quá trình bảo trì dữ liệu...'
            );

            // Gọi hàm đồng bộ địa chỉ mà chúng ta đã viết
            await syncWardsAddresses();
          } else {
            // Sai mật khẩu - Hiện cảnh báo "nguy hiểm"
            showToast(
              'error',
              'Mật khẩu không chính xác. Truy cập bị từ chối!'
            );
            console.warn(
              'Cảnh báo: Có hành vi thử truy cập trái phép vào mục Admin.'
            );
          }
        }
        async function syncWardsAddresses() {
          showToast('info', 'Bắt đầu giải mã địa chỉ hàng loạt...');

          // 1. Lấy danh sách các phường chưa có địa chỉ
          const { data: wards, error } = await supabaseClient
            .from('hcm_ward_stats')
            .select('maXa, X, Y')
            .is('dia_chi_goi_y', null);

          if (error) return console.error(error);
          if (wards.length === 0)
            return showToast('success', 'Tất cả địa chỉ đã được cập nhật!');

          for (const ward of wards) {
            // Gọi API giải mã (Reverse Geocoding)
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${ward.Y}&lon=${ward.X}&zoom=18`,
                {
                  headers: { 'Accept-Language': 'vi' },
                }
              );
              const json = await response.json();
              const address = json.display_name;

              // 2. Cập nhật lại vào Database
              await supabaseClient
                .from('hcm_ward_stats')
                .update({ dia_chi_goi_y: address })
                .eq('maXa', ward.maXa);

              console.log(`Đã cập nhật: ${ward.maXa}`);

              // Chờ 1 giây để không bị API chặn (Rate limit)
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (e) {
              console.error(`Lỗi tại mã xã ${ward.maXa}:`, e);
            }
          }
          showToast('success', 'Đã hoàn tất nạp địa chỉ vào Database!');
        }
        async function fastExportExcel() {
          if (!currentOptimalData || currentOptimalData.length === 0) {
            return showToast(
              'warning',
              'Sếp ơi, phải chạy "Tối ưu hóa" trên bản đồ trước khi xuất file!'
            );
          }

          showToast('info', 'Đang đóng gói danh sách kiểm tra...');

          try {
            const excelData = currentOptimalData.map((item, index) => ({
              STT: index + 1,
              'Đơn vị hành chính': item.ward_name,
              'Loại hình':
                item.location_type === 'random_point'
                  ? 'Giám sát định kỳ'
                  : 'Trọng điểm rủi ro',
              'Vĩ độ (Lat)': item.lat,
              'Kinh độ (Lng)': item.lng,
              'Tọa độ Maps': item.lat + ',' + item.lng,
              'Chỉ số rủi ro': item.final_score.toFixed(1),
              'Căn cứ phân loại': item.reason,
              'Ghi chú': 'Theo hướng dẫn tại TT 52/2024/TT-BYT',
            }));

            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // Tối ưu độ rộng cột để file nhìn chuyên nghiệp
            const wscols = [
              { wch: 5 },
              { wch: 25 },
              { wch: 20 },
              { wch: 15 },
              { wch: 15 },
              { wch: 25 },
              { wch: 15 },
              { wch: 40 },
              { wch: 30 },
            ];
            worksheet['!cols'] = wscols;

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(
              workbook,
              worksheet,
              'KeHoachSentinel'
            );

            // Xuất file với ngày tháng hiện tại
            const dateStr = new Date()
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, '');
            XLSX.writeFile(workbook, `HCDC_Sentinel_Plan_${dateStr}.xlsx`);

            showToast('success', 'Đã tải xuống danh sách vị trí lấy mẫu!');
          } catch (err) {
            showToast('error', 'Lỗi xuất file: ' + err.message);
          }
        }
        function toggleAIChat() {
          const chat = document.getElementById('ai-chat-window');
          chat.style.display =
            chat.style.display === 'none' || chat.style.display === ''
              ? 'flex'
              : 'none';
        }

        function handleChatKey(e) {
          if (e.key === 'Enter') sendChatToAI();
        }

        async function sendChatToAI(suggestedQuestion = null) {
          const input = document.getElementById('ai-chat-input');
          const body = document.getElementById('ai-chat-body');

          // 1. Lấy câu hỏi: Nếu bấm nút gợi ý thì lấy từ tham số, không thì lấy từ ô nhập
          const question = suggestedQuestion || input.value.trim();
          if (!question) return;

          // 2. Hiển thị câu hỏi của sếp lên khung chat
          body.innerHTML += `<div class="chat-msg user">${question}</div>`;
          if (!suggestedQuestion) input.value = ''; // Xóa ô nhập nếu gõ tay
          body.scrollTop = body.scrollHeight;

          // 3. Hiển thị trạng thái chờ
          const typingId = 'typing-' + Date.now();
          body.innerHTML += `<div class="chat-msg bot" id="${typingId}"><span class="spinner-border spinner-border-sm"></span> loading...</div>`;
          body.scrollTop = body.scrollHeight;

          try {
            // --- Lấy dữ liệu nhanh từ Front-end để AI có thêm ngữ cảnh ---
            let smartSummary = 'Dữ liệu Dashboard chưa sẵn sàng.';
            if (window.allData && allData.length > 0) {
              const total = allData.length;
              const fails = allData.filter(
                (d) => d.danh_gia_tu_dong === 'Không đạt'
              );
              smartSummary = `Dashboard đang hiển thị ${total} mẫu, có ${fails.length} mẫu lỗi.`;
            }

            // 4. Gọi Edge Function
            const { data, error } = await supabaseClient.functions.invoke(
              'hcdc-chatbot',
              { body: { prompt: question, dataSummary: smartSummary } }
            );

            const botArea = document.getElementById(typingId);
            if (error) throw error;

            if (data) {
              // 5. Hiển thị câu trả lời (Answer)
              // Chuyển đổi Markdown cơ bản sang HTML
              botArea.innerHTML = data.answer
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/### (.*?)<br>/g, '<h5>$1</h5>');

              // 6. HIỂN THỊ CÁC CÂU HỎI GỢI Ý (Suggestions)
              if (data.suggestions && data.suggestions.length > 0) {
                const suggestionBox = document.createElement('div');
                suggestionBox.className =
                  'suggestion-box mt-2 d-flex flex-wrap gap-2';

                data.suggestions.forEach((text) => {
                  const btn = document.createElement('button');
                  btn.className =
                    'btn btn-outline-info btn-sm rounded-pill py-1 px-3';
                  btn.innerText = text;
                  // Khi bấm vào gợi ý, gọi lại chính hàm này
                  btn.onclick = () => sendChatToAI(text);
                  suggestionBox.appendChild(btn);
                });

                botArea.appendChild(suggestionBox);
              }
            }
          } catch (err) {
            document.getElementById(typingId).innerText =
              'Sự cố: ' + err.message;
          }
          body.scrollTop = body.scrollHeight;
        }

        async function executeExport() {
          const type = document.getElementById('templateSelect').value;
          const WEB_APP_URL =
            'https://script.google.com/macros/s/AKfycbz5FQkJ-0sTENDjCGDfgUbfyoPosUEVaqTSWN3lBaUAF28-PvXu2ERnYYH7Q5x0OoXo/exec';
          const btn = document.getElementById('btn-final-export');

          if (btn) {
            btn.disabled = true;
            btn.innerHTML =
              '<i class="fas fa-spinner fa-spin"></i> Đang tạo file...';
          }

          try {
            // 🛡️ BẮT BUỘC: Không dùng mode: 'no-cors'
            const response = await fetch(WEB_APP_URL, {
              method: 'POST',
              body: JSON.stringify({
                type: type,
                data: currentReportTags, // Đảm bảo biến này đã có dữ liệu
              }),
            });

            // Kiểm tra nếu Server trả về lỗi (404, 500...)
            if (!response.ok) {
              throw new Error(`Server báo lỗi: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
              showToast('success', 'Xuất báo cáo thành công!');
              if (btn) {
                btn.disabled = false;
                btn.className = 'btn-success'; // Đổi màu nút cho rực rỡ
                btn.innerHTML =
                  '<i class="fas fa-external-link-alt"></i> MỞ BÁO CÁO';
                btn.onclick = () => window.open(result.url, '_blank');
              }
            } else {
              throw new Error(result.error || 'Lỗi không xác định từ Server');
            }
          } catch (error) {
            console.error('Lỗi chi tiết:', error);
            showToast('error', 'Lỗi: ' + error.message);
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-file-word"></i> THỬ LẠI';
            }
          }
        }

        function aggregateReportData(reports, units) {
          const tags = {};
          const now = new Date();
          const cleanStr = (s) => (s ? s.toString().trim().toLowerCase() : '');

          // --- 1. THÔNG TIN CHUNG ---
          tags['HCDC_BAO_CAO'] =
            'TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ HỒ CHÍ MINH';
          tags['PX_BAO_CAO'] = 'TRẠM Y TẾ';
          tags['NGAY'] = now.getDate();
          tags['THANG'] = now.getMonth() + 1;
          tags['NAM_HT'] = now.getFullYear();
          tags['QUY_BC'] = now.getMonth() + 1 <= 3 ? 'X' : '....';
          tags['CB_6T'] = now.getMonth() + 1 <= 6 ? 'X' : '....';
          tags['CB_1N'] = now.getMonth() + 1 > 6 ? 'X' : '....';

          // --- 2. ĐỊNH NGHĨA NGƯỠNG (THRESHOLD) ---
          const THRESHOLD = {
            COLI_TONG: 0,
            ECOLI: 0,
            ARSENIC: 0.01,
            DODUC: 2,
            MAUSAC: 15,
            MUIVI: 0,
            PEC: 2,
            PH_MIN: 6.0,
            PH_MAX: 8.5,
            CLO_MIN: 0.2,
            CLO_MAX: 1.0,
          };

          // --- 3. HÀM HELPER ---
          const getFailedParams = (r) => {
            let failedList = [];
            const check = (val, field, label) => {
              const v = parseFloat(val);
              if (isNaN(v)) return false;
              let isFail = false;
              if (field === 'ph')
                isFail = v < THRESHOLD.PH_MIN || v > THRESHOLD.PH_MAX;
              else if (field === 'clo_du')
                isFail = v < THRESHOLD.CLO_MIN || v > THRESHOLD.CLO_MAX;
              else if (field === 'asen') isFail = v > THRESHOLD.ARSENIC;
              else if (['coli_tong', 'ecoli', 'muivi'].includes(field))
                isFail = v > 0;
              else if (THRESHOLD[field.toUpperCase()] !== undefined)
                isFail = v > THRESHOLD[field.toUpperCase()];

              if (isFail) failedList.push(label);
              return isFail;
            };

            check(r.coli_tong, 'coli_tong', 'Coliform');
            check(r.ecoli, 'ecoli', 'E.coli');
            check(r.asen, 'asen', 'Asen');
            check(r.do_duc, 'do_duc', 'Độ đục');
            check(r.mau, 'mau', 'Màu sắc');
            check(r.muivi, 'muivi', 'Mùi vị');
            check(r.pec, 'pec', 'Permanganat');
            check(r.ph, 'ph', 'pH');
            check(r.clo_du, 'clo_du', 'Clo dư');
            return failedList;
          };

          const isSampleFailed = (r) => getFailedParams(r).length > 0;

          const filterByCap = (arr, min, max) =>
            arr.filter((u) => {
              const c = Number(u.capacity) || 0;
              return max ? c >= min && c < max : c >= min;
            }).length;

          // --- 4. PHÂN LOẠI DANH MỤC ĐƠN VỊ ---
          const allCSCCN = units.filter((u) => cleanStr(u.mode) === 'noikiem');
          const noiKiemIds = allCSCCN.map((u) => cleanStr(u.maphuong));

          // --- 5. XỬ LÝ NGOẠI KIỂM (HCDC, PX VÀ TỔNG) ---
          const allExternalReports = reports.filter(
            (r) => cleanStr(r.mode) === 'ngoaikiem'
          );

          // Tags Tổng Ngoại Kiểm (TOTAL_)
          tags['TOTAL_MAU_TONG'] = allExternalReports.length;
          const totalExtFailed = allExternalReports.filter(isSampleFailed);
          tags['TOTAL_MAU_KDAT'] = totalExtFailed.length;
          tags['TOTAL_MAU_DAT'] =
            tags['TOTAL_MAU_TONG'] - tags['TOTAL_MAU_KDAT'];
          const allExtFailedParams = [
            ...new Set(allExternalReports.flatMap((r) => getFailedParams(r))),
          ];
          tags['TOTAL_MAU_THONGSOLOI'] =
            allExtFailedParams.length > 0
              ? allExtFailedParams.join(', ')
              : 'Không có';

          // Hàm xử lý riêng cho HCDC và PX
          const processGroup = (prefix, isHCDC) => {
            const hcdcKeys = ['tphcm', 'binhduong', 'brvt', 'hcdc'];
            const groupReports = allExternalReports.filter((r) => {
              const isFromHCDC = hcdcKeys.includes(cleanStr(r.maphuong_temp));
              return isHCDC ? isFromHCDC : !isFromHCDC;
            });

            // Đã sửa: Định nghĩa visitedUnits bên trong để không bị lỗi ReferenceError
            const visitedIds = [
              ...new Set(groupReports.map((r) => cleanStr(r.maquan))),
            ];
            const visitedUnits = allCSCCN.filter((u) =>
              visitedIds.includes(cleanStr(u.maphuong))
            );

            tags[`TONG_DV_${prefix}_KT`] = visitedUnits.length;
            tags[`N1_${prefix}_KT`] = filterByCap(visitedUnits, 1000, 10000);
            tags[`N2_${prefix}_KT`] = filterByCap(visitedUnits, 10000, 100000);
            tags[`N3_${prefix}_KT`] = filterByCap(visitedUnits, 100000);

            tags[`NK_${prefix}_MAU_TONG`] = groupReports.length;
            const failed = groupReports.filter(isSampleFailed);
            tags[`NK_${prefix}_MAU_KDAT_TONG`] = failed.length;
            tags[`NK_${prefix}_MAU_DAT_TONG`] =
              groupReports.length - failed.length;

            // Tags cho Modal
            tags[`NK_${prefix}_MAU_KDAT`] = failed.length;
            tags[`NK_${prefix}_MAU_DAT`] = groupReports.length - failed.length;

            const countKDAT = (field, type) => {
              return groupReports.filter((r) => {
                const v = parseFloat(r[field]);
                if (isNaN(v)) return false;
                if (type === 'ZERO') return v > 0;
                if (type === 'RANGE_PH')
                  return v < THRESHOLD.PH_MIN || v > THRESHOLD.PH_MAX;
                if (type === 'RANGE_CLO')
                  return v < THRESHOLD.CLO_MIN || v > THRESHOLD.CLO_MAX;
                return v > THRESHOLD[type.toUpperCase()];
              }).length;
            };

            tags[`NK_${prefix}_COLI_KDAT`] = countKDAT('coli_tong', 'ZERO');
            tags[`NK_${prefix}_ECOLI_KDAT`] = countKDAT('ecoli', 'ZERO');
            tags[`NK_${prefix}_ASEN_KDAT`] = countKDAT('asen', 'ARSENIC');
            tags[`NK_${prefix}_DODUC_KDAT`] = countKDAT('do_duc', 'DODUC');
            tags[`NK_${prefix}_MAUSAC_KDAT`] = countKDAT('mau', 'MAUSAC');
            tags[`NK_${prefix}_MUIVI_KDAT`] = countKDAT('muivi', 'ZERO');
            tags[`NK_${prefix}_PEC_KDAT`] = countKDAT('pec', 'PEC');
            tags[`NK_${prefix}_CLO_KDAT`] = countKDAT('clo_du', 'RANGE_CLO');
            tags[`NK_${prefix}_PH_KDAT`] = countKDAT('ph', 'RANGE_PH');
            // --- Bổ sung liệt kê thông số lỗi riêng cho từng nhóm (HCDC/PX) ---
            const groupFailedParams = [
              ...new Set(groupReports.flatMap((r) => getFailedParams(r))),
            ];

            tags[`NK_${prefix}_MAU_THONGSOLOI`] =
              groupFailedParams.length > 0
                ? groupFailedParams.join(', ')
                : 'Không có';
          };

          processGroup('HCDC', true);
          processGroup('PX', false);

          // --- 6. XỬ LÝ NỘI KIỂM (PHẦN A & C) ---
          const internalReports = reports.filter((r) =>
            noiKiemIds.includes(cleanStr(r.maphuong_temp))
          );
          tags['INT_MAU_TONG'] = internalReports.length;

          const countIntKDAT = (field, type) => {
            return internalReports.filter((r) => {
              const v = parseFloat(r[field]);
              if (isNaN(v)) return false;
              if (type === 'ZERO') return v > 0;
              if (type === 'RANGE_PH')
                return v < THRESHOLD.PH_MIN || v > THRESHOLD.PH_MAX;
              if (type === 'RANGE_CLO')
                return v < THRESHOLD.CLO_MIN || v > THRESHOLD.CLO_MAX;
              return v > THRESHOLD[type.toUpperCase()];
            }).length;
          };

          tags['INT_COLI_KDAT'] = countIntKDAT('coli_tong', 'ZERO');
          tags['INT_ECOLI_KDAT'] = countIntKDAT('ecoli', 'ZERO');
          tags['INT_ASEN_KDAT'] = countIntKDAT('asen', 'ARSENIC');
          tags['INT_CLO_KDAT'] = countIntKDAT('clo_du', 'RANGE_CLO');
          tags['INT_DODUC_KDAT'] = countIntKDAT('do_duc', 'DODUC');
          tags['INT_MAUSAC_KDAT'] = countIntKDAT('mau', 'MAUSAC');
          tags['INT_MUIVI_KDAT'] = countIntKDAT('muivi', 'ZERO');
          tags['INT_PH_KDAT'] = countIntKDAT('ph', 'RANGE_PH');
          tags['INT_PEC_KDAT'] = countIntKDAT('pec', 'PEC');

          const intFailedReports = internalReports.filter(isSampleFailed);
          tags['INT_MAU_KDAT'] = intFailedReports.length;
          tags['INT_MAU_DAT'] =
            internalReports.length - intFailedReports.length;
          const intFailedParams = [
            ...new Set(internalReports.flatMap((r) => getFailedParams(r))),
          ];
          tags['INT_MAU_THONGSOLOI'] =
            intFailedParams.length > 0
              ? intFailedParams.join(', ')
              : 'Không có';

          // Đếm đơn vị Nội kiểm thực hiện
          const activeNoiKiemIds = [
            ...new Set(internalReports.map((r) => cleanStr(r.maphuong_temp))),
          ];
          const checkedUnits = allCSCCN.filter((u) =>
            activeNoiKiemIds.includes(cleanStr(u.maphuong))
          );

          tags['TONG_DV_KT'] = checkedUnits.length;
          tags['N1_KT'] = filterByCap(checkedUnits, 100, 1000);
          tags['N2_KT'] = filterByCap(checkedUnits, 1000, 15000);
          tags['N3_KT'] = filterByCap(checkedUnits, 15000, 30000);
          tags['N4_KT'] = filterByCap(checkedUnits, 30000);

          // --- 7. CÁC THẺ PHỤ TRÁCH (PHẦN A) ---
          // 1. Nhóm HCDC phụ trách (Công suất >= 1000 m3/nđ)
          const hcdcPTUnits = allCSCCN.filter(
            (u) => (Number(u.capacity) || 0) >= 1000
          );
          tags['TONG_DV_HCDC_PT'] = hcdcPTUnits.length;
          // Tính tổng dân số nhóm HCDC phụ trách
          tags['TONG_DV_HCDC_SODAN_PT'] = hcdcPTUnits.reduce(
            (sum, u) => sum + (Number(u.total_households) || 0),
            0
          );

          // 2. Nhóm PX phụ trách (Công suất < 1000 m3/nđ)
          // Sếp lưu ý: Nếu PX chỉ quản lý trạm nhỏ thì dùng < 1000,
          // Nếu PX quản lý TẤT CẢ thì dùng pxPTUnits = allCSCCN;
          const pxPTUnits = allCSCCN.filter(
            (u) => (Number(u.capacity) || 0) < 1000
          );
          tags['TONG_DV_PX_PT'] = pxPTUnits.length;
          // Tính tổng dân số nhóm PX phụ trách
          tags['TONG_DV_PX_SODAN_PT'] = pxPTUnits.reduce(
            (sum, u) => sum + (Number(u.total_households) || 0),
            0
          );

          // 3. Tổng dân số toàn Thành phố (Phần A - Tổng cộng)
          tags['TONG_DV_PT'] = allCSCCN.length;
          tags['N1_PT'] = filterByCap(allCSCCN, 100, 1000);
          tags['N2_PT'] = filterByCap(allCSCCN, 1000, 15000);
          tags['N3_PT'] = filterByCap(allCSCCN, 15000, 30000);
          tags['N4_PT'] = filterByCap(allCSCCN, 30000);
          tags['TONG_CS_TT'] = allCSCCN.reduce(
            (sum, u) => sum + (Number(u.capacity) || 0),
            0
          );
          tags['TYLE_DAN'] = ((tags['TONG_DAN'] / 9400000) * 100).toFixed(2);
          // 1. Tổng dân số của TOÀN BỘ các trạm trong hệ thống (Denominator)
          const tongDanHeThong = allCSCCN.reduce(
            (sum, u) => sum + (Number(u.total_households) || 0),
            0
          );
          tags['TONG_DAN'] = tongDanHeThong;

          // 2. Tính tỷ lệ dân số PX phụ trách so với Tổng dân hệ thống
          // Thêm "|| 1" để tránh lỗi chia cho 0 khiến báo cáo hiện "NaN"
          tags['TYLE_DAN_PX'] = (
            (tags['TONG_DV_PX_SODAN_PT'] / (tongDanHeThong || 1)) *
            100
          ).toFixed(2);

          // 3. Nếu sếp muốn tính tỷ lệ so với dân số toàn TP (ví dụ 9.4 triệu dân)
          const DAN_SO_TP_HCM = 9400000;
          tags['TYLE_BAO_PHU_PX'] = (
            (tags['TONG_DV_PX_SODAN_PT'] / DAN_SO_TP_HCM) *
            100
          ).toFixed(2);
          return tags;
        }
        // 2. Hàm điều khiển Modal (Dùng cho hệ thống không Bootstrap)
        async function handleExport() {
          const modal = document.getElementById('customModal');
          const loading = document.getElementById('pv-loading');
          const content = document.getElementById('pv-content');
          const templateSelect = document.getElementById('templateSelect');

          if (!modal || !loading || !content) {
            alert('Thiếu cấu trúc HTML Modal sếp ơi!');
            return;
          }

          // 1. Hiển thị trạng thái chờ
          modal.style.display = 'block';
          loading.style.display = 'block';
          content.style.display = 'none';

          // 2. Lấy dải thời gian hiển thị
          const period = document.getElementById('date-label')
            ? document.getElementById('date-label').innerText
            : 'Chưa chọn';
          const pvPeriod = document.getElementById('pv-period');
          if (pvPeriod) pvPeriod.innerText = period;

          // 3. TÍNH TOÁN DỮ LIỆU (Chạy 1 lần duy nhất khi mở Modal)
          setTimeout(() => {
            try {
              const dataToProcess =
                typeof filteredData !== 'undefined' ? filteredData : [];

              // Gọi hàm aggregateReportData thần thánh của anh em mình
              // Lưu vào biến toàn cục để dùng khi đổi Dropdown
              currentReportTags = aggregateReportData(
                dataToProcess,
                allUnits || []
              );

              console.log('✅ Tags đã sẵn sàng:', currentReportTags);

              // 4. ĐỔ DỮ LIỆU VÀO GIAO DIỆN
              renderPreviewData();

              // 5. GẮN SỰ KIỆN ĐỔI MẪU (Để khi sếp chọn 03/04 số nó tự nhảy)
              templateSelect.onchange = () => {
                renderPreviewData();
              };

              // Hoàn tất: Hiện nội dung
              loading.style.display = 'none';
              content.style.display = 'block';
            } catch (e) {
              console.error('Lỗi Render Modal:', e);
              loading.innerHTML = `<div style="color:red; padding:20px;">
        <i class="fas fa-exclamation-triangle"></i> Lỗi tính toán: ${e.message}
      </div>`;
            }
          }, 300);
        }

        // Hàm Helper để render dữ liệu lên Modal dựa trên Mẫu đã chọn
        function renderPreviewData() {
          const tags = currentReportTags;
          const type = document.getElementById('templateSelect').value; // '03' hoặc '04'

          const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val !== undefined && val !== null ? val : 0;
          };

          // --- PHẦN A: TÌNH HÌNH CHUNG (Linh hoạt theo loại báo cáo) ---
          if (type === '03') {
            // Mẫu 03: Hiện số liệu HCDC phụ trách
            setVal('pv-pt', tags['TONG_DV_HCDC_PT']);
            setVal('pv-kt', tags['TONG_DV_HCDC_KT']);
            document.getElementById('pv-ext-label').innerText = 'HCDC';

            // Ngoại kiểm nhóm HCDC
            setVal('pv-b1', tags['NK_HCDC_MAU_TONG']);
            setVal('pv-b2', tags['NK_HCDC_MAU_DAT']);
            setVal('pv-b3', tags['NK_HCDC_MAU_KDAT']);
            setVal('pv-b-errors', tags['NK_HCDC_MAU_THONGSOLOI'] || 'Không có');
          } else {
            // Mẫu 04: Hiện số liệu Tuyến cơ sở (PX) phụ trách
            setVal('pv-pt', tags['TONG_DV_PX_PT']);
            setVal('pv-kt', tags['TONG_DV_PX_KT']);
            document.getElementById('pv-ext-label').innerText = 'Tuyến cơ sở';

            // Ngoại kiểm nhóm PX
            setVal('pv-b1', tags['NK_PX_MAU_TONG']);
            setVal('pv-b2', tags['NK_PX_MAU_DAT']);
            setVal('pv-b3', tags['NK_PX_MAU_KDAT']);
            setVal('pv-b-errors', tags['NK_PX_MAU_THONGSOLOI'] || 'Không có');
          }

          // Các thẻ chung của hệ thống
          setVal('pv-cs', (tags['TONG_CS_TT'] || 0).toLocaleString());
          setVal('pv-dan', (tags['TONG_DAN'] || 0).toLocaleString());

          // --- PHẦN B: NỘI KIỂM ĐƠN VỊ (Dùng chung cho cả 2 mẫu) ---
          setVal('pv-c1', tags['INT_MAU_TONG']);
          setVal('pv-c2', tags['INT_MAU_DAT']);
          setVal('pv-c3', tags['INT_MAU_KDAT']);
          setVal('pv-c-errors', tags['INT_MAU_THONGSOLOI'] || 'Không có');
        }

        // 3. Hàm đóng Modal
        function closeCustomModal() {
          const modal = document.getElementById('customModal');
          if (modal) modal.style.display = 'none';
        }
        /**
         * Xuất báo cáo từ Template dựa trên bộ Tags
         */
        function createHealthReport(templateType, reportData) {
          const FOLDER_ID = '1DVT-63FnQXhFhJ5mhWR9KSOyPl7jfseJ';
          const TEMPLATES = {
            '03': '17OEGAT8ANzPKye65UmPHJSIAWV_89YHXYLuW3EFhvb4',
            '04': '1dW_EiJjErA811HfGMHhJVnxxbw0RgADzoNgIFsmXaL4',
          };

          const templateFile = DriveApp.getFileById(TEMPLATES[templateType]);
          const folder = DriveApp.getFolderById(FOLDER_ID);

          // Tạo bản sao mới
          const fileName = `Bao_cao_Mau_${templateType}_${
            reportData.NAM_HT
          }_${new Date().getTime()}`;
          const copy = templateFile.makeCopy(fileName, folder);
          const doc = DocumentApp.openById(copy.getId());
          const body = doc.getBody();

          // Thay thế các thẻ Tag đơn giản
          for (let tag in reportData) {
            body.replaceText(`{{${tag}}}`, reportData[tag] || '0');
          }

          doc.saveAndClose();
          return {
            url: doc.getUrl(),
            name: fileName,
          };
        }
        //INIT()
        init();
