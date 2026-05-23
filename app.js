// Full dataset of shows translated to English and Vietnamese
    let showsData = [];

    // Remove Vietnamese accents / diacritics for better searching
    function removeVietnameseTones(str) {
      str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
      str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
      str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
      str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
      str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
      str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
      str = str.replace(/đ/g, "d");
      str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
      str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
      str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
      str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
      str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
      str = str.replace(/Ý|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
      str = str.replace(/Đ/g, "D");
      str = str.replace(/\u0300|\u0301|\u0309|\u0303|\u0323/g, ""); // Huyền sắc hỏi ngã nặng 
      str = str.replace(/\u02c6|\u0306|\u031b/g, ""); // Â, Ă, Ơ, Ư
      return str;
    }

    // Custom descriptions database mapping based on show names
    function getShowDescription(show) {
      const name = show.chinese || "";
      const plat = show.platform;
      const status = show.status;
      let statusStr = status === "upcoming" ? "sắp phát sóng" : (status === "airing" ? "đang phát sóng" : "đã phát sóng trọn bộ");

      if (name.includes("心动的信号")) {
        return `Tên Anh đối chiếu: Heart Signal. Đây là series hẹn hò quan sát nổi tiếng của Tencent Video, phát triển từ format Heart Signal Hàn Quốc: nhóm nam nữ độc thân sống trong "nhà tín hiệu", tương tác đời thường và gửi tín hiệu tình cảm ẩn danh. Điểm mạnh của show là phần suy luận của ban quan sát, các tuyến cảm xúc chậm rãi và dữ liệu hành vi nhỏ như ánh mắt, tin nhắn, lựa chọn chỗ ngồi.`;
      }
      if (name.includes("半熟恋人")) {
        return `Giới thiệu "Người Yêu Một Nửa Thân Thuộc Mùa 5" là một chương trình truyền hình thực tế tập trung vào công việc và cuộc sống thực của những người ở độ tuổi cuối 30 và đầu 40. Một nhóm những cá nhân năng động ở độ tuổi cuối 30, tràn đầy những trải nghiệm sống phong phú và đa dạng, xuất hiện trong chương trình. Một số người là những người tiên phong trong sự nghiệp, trong khi những người khác là những người theo đuổi đam mê một cách tận tâm. Trải qua những thử thách của thời gian, họ vẫn giữ được sự hiểu biết sáng suốt về cuộc sống mà không bao giờ đánh mất khát khao chân thành về tình yêu. Cuối cùng, chương trình khắc họa một bức tranh đa dạng về các mối quan hệ của những người ở độ tuổi cuối 30 và đầu 40, thoát khỏi những ràng buộc về tuổi tác và các chuẩn mực truyền thống - tình yêu không có hình thức cố định; nơi trái tim dẫn lối, đó là nơi cuộc hành trình kết thúc.`;
	  }
      if (name.includes("势均力敌的我们")) {
        return `Tên Anh đã ưu tiên theo YouTube/Tencent: Live and Love. Chương trình đặt các khách mời có cá tính và năng lực tương đối "ngang tài ngang sức" vào môi trường hẹn hò giàu cạnh tranh, nơi lựa chọn tình cảm đi cùng thử thách, quan sát phản ứng và tương tác nhóm. Tên Việt giữ nghĩa "môn đăng hộ đối/ngang tài ngang sức" để phản ánh đúng hàm ý gốc của 势均力敌.`;
      }
      if (name.includes("有秘密的我们")) {
        return `Tên Anh đã ưu tiên theo YouTube/Tencent: Secrets in Love. Điểm nhận diện của show là mỗi khách mời bước vào hành trình hẹn hò với một bí mật, một bối cảnh cá nhân hoặc một điều chưa nói rõ; quá trình tìm hiểu vì vậy vừa có yếu tố lãng mạn vừa có yếu tố giải mã. Tên Việt nên dùng "Bí Mật Trong Tình Yêu" thay vì dịch sát "Chúng Ta Có Bí Mật" để tự nhiên hơn.`;
      }
      if (name.includes("好友好有爱")) {
        return `Show khai thác ranh giới giữa tình bạn thân và khả năng tiến tới tình yêu. Các cặp hoặc nhóm bạn bước vào môi trường hẹn hò để kiểm tra xem sự thân thiết lâu năm là thói quen, sự phụ thuộc hay thật sự có tín hiệu lãng mạn. Tên Anh hiện chưa thấy một chuẩn quốc tế ổn định như Heart Signal hay Love Actually, nên giữ bản dịch dễ hiểu "Best Friends' Love" và bổ sung nghĩa "friends to lovers" trong mô tả.`;
      }
      if (name.includes("日落时分说爱你")) {
        return `Show hướng tới không khí lãng mạn, chậm rãi và trưởng thành hơn, lấy hình ảnh "nói yêu lúc hoàng hôn" làm điểm tựa cảm xúc. Nội dung phù hợp nhóm khán giả thích dating show thiên về trò chuyện, quan sát lựa chọn của người tham gia và những khoảnh khắc bày tỏ tình cảm trực tiếp. Tên Anh "Say I Love You at Sunset" là bản dịch sát nghĩa, chưa thấy tên quốc tế phổ biến hơn.`;
      }
      if (name.includes("我们与恋ares的距离") || name.includes("我们与恋爱的距离")) {
        return `Giới thiệu chương trình: Chương trình tập trung vào xu hướng xã hội "mối quan hệ phụ nữ lớn tuổi - đàn ông trẻ tuổi" và mời 10 khách mời nam và nữ ở các giai đoạn cuộc sống khác nhau cùng chuyển đến "Ngôi nhà Tình yêu" để bắt đầu một "thí nghiệm xã hội về tình yêu" kéo dài 10 ngày. Họ sẽ gặp gỡ và làm quen với nhau mà không bị ràng buộc bởi các định kiến ​​xã hội (như tuổi tác/giới tính/hoàn cảnh gia đình/nghề nghiệp/thu nhập), và bắt đầu một hành trình tìm kiếm tình yêu dựa hoàn toàn vào trực giác và sự yêu thích lẫn nhau!`;
        }
      if (name.includes("怦然心动20岁")) {
        return `Tên Anh đối chiếu: Twinkle Love. Đây là show hẹn hò thanh xuân của Youku, ghi lại hành trình du lịch và trưởng thành của các bạn trẻ quanh tuổi 20. Format nổi bật ở không khí mùa hè, chuyến đi tập thể, lời nhắn rung động và cảm giác "tốt nghiệp trước khi bước vào đời". Tên Việt "Rung Động Tuổi 20" bám sát nghĩa gốc và đúng tinh thần show.`;
      }
      if (name.includes("我们恋爱吧")) {
        return `Tên Anh đối chiếu: Let's Fall In Love; một số cộng đồng quốc tế cũng gọi là Relationship. Show đưa các nam nữ độc thân vào hành trình sống chung hoặc du lịch ngắn ngày, kết hợp hẹn hò, nhiệm vụ tương tác và ban quan sát phân tích tâm lý. Tên Việt "Chúng Ta Yêu Nhau Đi" là bản dịch sát, dễ tìm và dễ hiểu.`;
      }
      if (name.includes("喜欢你我也是")) {
        return `Tên Anh chính thức trên iQIYI quốc tế: Yes, I Do. Đây là dating reality theo mô hình người chơi sống chung, quan sát tín hiệu và lựa chọn người mình thích qua các hoạt động hằng ngày. Tên tiếng Việt nên dịch theo nghĩa "Em/Anh cũng thích bạn" thay vì "Love You Too" vì tên Anh chính thức không dùng cụm đó.`;
      }
      if (name.includes("没谈过恋爱的我")) {
        return `Tên Anh phổ biến trên cộng đồng/nguồn phụ đề: So in Love. Format đặc biệt ở chỗ khách mời là những người gần như chưa từng yêu hoặc thiếu kinh nghiệm tình cảm, vì vậy câu chuyện xoay quanh lần đầu học cách bày tỏ, đặt ranh giới và nhận diện tín hiệu. Tên Việt "Tôi Chưa Từng Yêu Đương" là bản dịch rõ nghĩa nhất.`;
      }
      if (name.includes("机智的恋爱")) {
        return `Tên Anh thường dùng: The Secret X. Đây là phiên bản Trung Quốc mang hơi hướng Love Catcher: người chơi vừa hẹn hò vừa phải đọc vị động cơ của nhau, khiến lựa chọn tình cảm đi kèm yếu tố suy luận và chiến thuật. Tên Việt "Ẩn Số Tình Yêu" truyền tải đúng chữ X/bí mật hơn so với dịch sát "Tình Yêu Mưu Trí".`;
      }
      if (name.includes("春日迟迟再出发")) {
        return `Tên Anh đối chiếu: See You Again. Đây là show chữa lành của Mango TV dành cho những người từng trải qua đổ vỡ tình cảm hoặc hôn nhân, cùng đi qua một hành trình để nhìn lại quá khứ và thử mở lòng lần nữa. Tên Việt có thể dùng "Gặp Lại Nhau" cho tự nhiên, kèm "Xuân Muộn Lại Lên Đường" để giữ nghĩa gốc.`;
      }
      if (name.includes("再次心动")) {
        return `Tên Anh phổ biến: Once More. Show xoay quanh những người muốn thử rung động lại sau giai đoạn đổ vỡ, do dự hoặc mất niềm tin vào tình yêu. Mô tả tiếng Việt nên nhấn vào yếu tố "lại rung động" thay vì chỉ dịch chữ "heartbeat again".`;
      }
      if (name.includes("恋爱兄妹")) {
        return `Tên Anh đối chiếu: My Sibling's Romance. Đây là show Hàn Quốc được phát hành với tên Trung, nơi anh chị em ruột cùng tham gia hành trình hẹn hò và thường phải che giấu quan hệ gia đình trong giai đoạn đầu. Sức hút đến từ sự giao thoa giữa tình thân, sự bảo vệ của anh chị em và lựa chọn tình cảm cá nhân.`;
      }
      if (name.includes("仔仔一堂")) {
        return `Tên Anh chính thức/phổ biến: Boyscation. Đây là show hẹn hò đồng tính nam của Hồng Kông, quy tụ các chàng trai độc thân cùng sống chung, trò chuyện về bản dạng, gia đình, định kiến xã hội và nhu cầu được yêu công khai. Tên Việt nên ghi rõ BL/nam-nam để người xem nhận diện đúng nhóm khách mời.`;
      }
      if (name.includes("男生男生配")) {
        return `Tên Anh chính thức/phổ biến: Boys Like Boys. Show hẹn hò nam-nam của Đài Loan, tập trung vào quá trình các chàng trai sống chung, chọn buổi hẹn và chia sẻ câu chuyện cá nhân. Không khí nhẹ hơn các show cạnh tranh, nhấn vào sự thành thật, tự nhận diện và cảm giác được nhìn thấy trong cộng đồng LGBTQ+.`;
      }
      if (name.includes("逃离朝九晚五的恋爱")) {
        return `Show nhắm vào nhóm người trẻ đi làm, dùng bối cảnh thoát khỏi nhịp "9-to-5" để tạo không gian hẹn hò ngoài áp lực công sở. Nội dung thường hấp dẫn ở các mâu thuẫn rất đời: thiếu thời gian, ưu tiên sự nghiệp, khoảng cách thành phố và tiêu chuẩn thực tế khi chọn người yêu.`;
      }
      if (name.includes("偏爱之恋")) {
        return `Show tập trung vào khái niệm "thiên vị" trong tình yêu: khi một người không chỉ được chọn vì phù hợp, mà còn vì trở thành ngoại lệ đặc biệt trong mắt đối phương. Tên Anh "Preference of Love" là bản dịch sát nghĩa, còn tên Việt "Tình Yêu Thiên Vị" giữ đúng sắc thái gốc.`;
      }
      if (name.includes("女神配对计划")) {
        return `Show ghép đôi theo hướng hình tượng hóa các khách mời nữ là "nữ thần", đặt trọng tâm vào lựa chọn, sức hút cá nhân và phản ứng của những người theo đuổi. Tên Anh "Goddess Matchmaking Project" và tên Việt "Kế Hoạch Ghép Đôi Nữ Thần" đều là bản dịch sát, phù hợp để tìm kiếm.`;
      }
      if (name.includes("恋爱特别邀请")) {
        return `Show dùng ý tưởng "lời mời đặc biệt" để đưa người chơi vào các tình huống hẹn hò được sắp đặt có chủ đích. Điểm đáng xem là ai chủ động gửi lời mời, ai chấp nhận, và phản ứng của người còn lại khi tình cảm được kéo ra khỏi vùng an toàn.`;
      }
      if (name.includes("有你的恋歌")) {
        return `Show kết hợp chất liệu âm nhạc/tình ca với hành trình hẹn hò, tạo bầu không khí mềm hơn các chương trình suy luận tín hiệu. Tên Anh "Love Song With You" và tên Việt "Bản Tình Ca Có Em" là cặp tên dịch tự nhiên, giữ đúng hình ảnh 恋歌 trong tên gốc.`;
      }
      if (name.includes("恋爱Staycation")) {
        return `Show khai thác mô hình staycation: khách mời không cần đi xa mà cùng ở trong không gian nghỉ dưỡng ngắn ngày để quan sát nhịp sống, thói quen và cách tương tác tự nhiên. Tên Việt nên giữ "Staycation" hoặc dịch là "Kỳ Nghỉ Yêu Đương" để không làm mất format.`;
      }
      if (name.includes("我们练爱吧")) {
        return `Tên gốc dùng chữ 练爱, nhấn vào việc "luyện tập yêu" hơn là tuyên bố yêu ngay. Show phù hợp nhóm người xem thích quá trình học giao tiếp, thử hẹn hò, điều chỉnh kỳ vọng và trưởng thành qua tương tác. Tên Việt "Chúng Ta Tập Yêu Đi" phản ánh đúng sắc thái này.`;
      }

      if (show.tags.includes("all-female")) {
        return `Show hẹn hò thực tế toàn nữ/GL ${statusStr} trên ${plat}. Nội dung tập trung vào cách các khách mời nữ làm quen, chọn người đồng hành, chia sẻ giới hạn cá nhân và xây dựng sự tin tưởng trong không gian sống chung hoặc nhiệm vụ hẹn hò. Tên Anh hiện chủ yếu là bản dịch nghĩa hoặc tên cộng đồng, vì vậy tên Việt giữ thêm chú thích GL để người xem tìm đúng nhóm show.`;
      }
      if (show.tags.includes("all-male")) {
        return `Show hẹn hò thực tế toàn nam/BL ${statusStr} trên ${plat}. Nội dung thường nhấn vào đời sống chung, buổi hẹn một-một, câu chuyện coming out, kỳ vọng quan hệ lâu dài và cách các khách mời nam xử lý rung động công khai trước máy quay. Tên Việt giữ chú thích BL để phân biệt với các show nam nữ thông thường.`;
      }
      
      return `${show.vietnamese} (${show.english}) là show hẹn hò thực tế ${statusStr} trên ${plat}. Dựa trên tên gốc "${show.chinese}", chương trình nhiều khả năng xoay quanh hành trình người độc thân gặp gỡ, trò chuyện, tham gia nhiệm vụ kết nối và kiểm tra mức độ phù hợp qua các buổi hẹn. Phần tên tiếng Anh/Việt đã được chuẩn hóa theo hướng dễ tìm kiếm, ưu tiên tên nền tảng/YouTube nếu có, còn những show mới hoặc ít nguồn quốc tế được dịch nghĩa tự nhiên từ tiếng Trung.`;
    }

    // Active state tracker for filters
    const COUNTRY_OPTIONS = [
      { code: "china", label: "Trung Quốc", flag: "🇨🇳" },
      { code: "korea", label: "Hàn Quốc", flag: "🇰🇷" },
      { code: "japan", label: "Nhật Bản", flag: "🇯🇵" },
      { code: "thailand", label: "Thái Lan", flag: "🇹🇭" },
      { code: "taiwan", label: "Đài Loan", flag: "🇹🇼" },
      { code: "hongkong", label: "Hồng Kông", flag: "🇭🇰" },
      { code: "singapore", label: "Singapore", flag: "🇸🇬" },
      { code: "other", label: "Khác", flag: "🌏" }
    ];

    const COUNTRY_BY_CHINESE = [
      ["恋爱兄妹", "korea"],
      ["仔仔一堂", "hongkong"],
      ["男生男生配", "taiwan"]
    ];

    const COUNTRY_BY_PLATFORM = {
      "TVB": "hongkong",
      "GagaOOLala": "taiwan"
    };

    let currentFilters = {
      search: "",
      status: "all",
      country: "all",
      tag: "all",
      sort: "name-asc"
    };

    const CUSTOM_SHOWS_STORAGE_KEY = "cnDatingShowsCustomShowsV1";
    const HIDDEN_SHOWS_STORAGE_KEY = "cnDatingShowsHiddenShowsV1";
    let currentModalIndex = null;
    let settingsLocked = true;
    let settingsSearchQuery = "";
    let customShows = loadCustomShows();
    mergeLegacyCustomShowsIntoShowsData();

    function loadCustomShows() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CUSTOM_SHOWS_STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn("Không đọc được danh sách show tự thêm:", err);
        return [];
      }
    }

    function saveCustomShows() {
      localStorage.setItem(CUSTOM_SHOWS_STORAGE_KEY, JSON.stringify(customShows));
    }

    function cleanRuntimeFields(show) {
      const cleaned = { ...show };
      delete cleaned._index;
      delete cleaned._isCustom;
      delete cleaned._customId;
      return cleaned;
    }

    function mergeLegacyCustomShowsIntoShowsData() {
      if (!Array.isArray(customShows) || !customShows.length) return;

      customShows.forEach(customShow => {
        const cleaned = cleanRuntimeFields(customShow);
        const duplicateIndex = showsData.findIndex(show =>
          show.chinese === cleaned.chinese ||
          (show.english && cleaned.english && show.english === cleaned.english) ||
          (show.vietnamese && cleaned.vietnamese && show.vietnamese === cleaned.vietnamese)
        );

        if (duplicateIndex >= 0) {
          showsData[duplicateIndex] = { ...showsData[duplicateIndex], ...cleaned };
        } else {
          showsData.push(cleaned);
        }
      });

      customShows = [];
      saveCustomShows();
    }

    function loadHiddenShowKeys() {
      try {
        const parsed = JSON.parse(localStorage.getItem(HIDDEN_SHOWS_STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn("Không đọc được danh sách show đã ẩn:", err);
        return [];
      }
    }

    function saveHiddenShowKeys(keys) {
      localStorage.setItem(HIDDEN_SHOWS_STORAGE_KEY, JSON.stringify(keys));
    }

    function getShowKey(show) {
      return show._customId || show.chinese;
    }

    function findShowsDataIndexByKey(key) {
      return showsData.findIndex(show => getShowKey(show) === key);
    }

    function getAllShowsRaw() {
      const hidden = new Set(loadHiddenShowKeys());
      return showsData
        .filter(show => !hidden.has(getShowKey(show)))
        .map(show => ({ ...show, _isCustom: false }));
    }

    function resolveShowIndex(index) {
      const allShows = getAllShowsRaw();
      if (index < 0 || index >= allShows.length) return null;

      const baseShow = allShows[index];
      const isCustom = !!baseShow._isCustom;
      const customIndex = isCustom
        ? customShows.findIndex(show => getShowKey(show) === getShowKey(baseShow))
        : -1;

      return { baseShow, isCustom, customIndex };
    }

    function getShowRating(show) {
      const rating = Number(show?.rating);
      if (!Number.isFinite(rating) || rating <= 0) return 0;
      return Math.min(5, Math.max(0, Math.round(rating)));
    }

    function isValidCountryCode(code) {
      return COUNTRY_OPTIONS.some(option => option.code === code);
    }

    function inferShowCountry(show) {
      for (const [keyword, country] of COUNTRY_BY_CHINESE) {
        if (show.chinese && show.chinese.includes(keyword)) return country;
      }
      if (show.platform && COUNTRY_BY_PLATFORM[show.platform]) {
        return COUNTRY_BY_PLATFORM[show.platform];
      }
      return "china";
    }

    function getShowCountry(show) {
      const stored = String(show?.country || "").trim();
      if (stored && isValidCountryCode(stored)) return stored;
      return inferShowCountry(show);
    }

    function getCountryMeta(code) {
      return COUNTRY_OPTIONS.find(option => option.code === code) || COUNTRY_OPTIONS[COUNTRY_OPTIONS.length - 1];
    }

    function countryLabel(code) {
      return getCountryMeta(code).label;
    }

    function renderCountryBadge(show) {
      const code = getShowCountry(show);
      const meta = getCountryMeta(code);
      return `<span class="badge badge-country ${code}" title="Quốc gia: ${escapeHtml(meta.label)}">${meta.flag} ${escapeHtml(meta.label)}</span>`;
    }

    function parseWatchLinkEntry(entry) {
      if (!entry) return null;

      if (typeof entry === "string") {
        const url = entry.trim();
        return url ? { url, label: "" } : null;
      }

      if (typeof entry === "object") {
        const url = String(entry.url || entry.link || "").trim();
        const label = String(entry.label || entry.name || "").trim();
        return url ? { url, label } : null;
      }

      return null;
    }

    // Auto detect platform name based on URL domain
    function detectPlatformFromUrl(url) {
      if (!url) return "";
      const lower = url.toLowerCase();
      if (lower.includes("iqiyi.com") || lower.includes("iqiyi")) return "iQiyi";
      if (lower.includes("v.qq.com") || lower.includes("tencent")) return "Tencent Video";
      if (lower.includes("mgtv.com") || lower.includes("mango")) return "Mango TV";
      if (lower.includes("youku.com") || lower.includes("youku")) return "Youku";
      if (lower.includes("bilibili.com") || lower.includes("bilibili")) return "Bilibili";
      if (lower.includes("rophim1.vip") || lower.includes("rophim")) return "Rophim";
      if (lower.includes("yeuphim.biz") || lower.includes("yeuphim")) return "Yêu Phim";
      if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "YouTube";
      if (lower.includes("ok.ru")) return "OK.ru";
      if (lower.includes("dailymotion.com") || lower.includes("dailymotion")) return "Dailymotion";
      return "";
    }

    function getWatchLinksByType(show, type) {
      const arrayKey = type === "chinese" ? "chineseWatchUrls" : "vietnameseWatchUrls";
      const legacyKey = type === "chinese" ? "chineseWatchUrl" : "vietnameseWatchUrl";
      const entries = [];
      const seen = new Set();

      const addEntry = raw => {
        const parsed = parseWatchLinkEntry(raw);
        if (!parsed || seen.has(parsed.url)) return;
        seen.add(parsed.url);
        entries.push(parsed);
      };

      if (Array.isArray(show[arrayKey])) {
        show[arrayKey].forEach(addEntry);
      }
      if (show[legacyKey]) {
        addEntry(show[legacyKey]);
      }

      const total = entries.length;
      return entries.map((entry, index) => {
        let label = entry.label;
        let detected = detectPlatformFromUrl(entry.url);
        let note = "";

        if (type === "chinese") {
          if (!label) {
            label = total > 1 ? `Nơi chiếu tiếng Trung #${index + 1}` : "Nơi chiếu tiếng Trung";
          }
          note = detected || show.platform || "Tiếng Trung";
        } else {
          if (!label) {
            label = total > 1 ? `Link tiếng Việt #${index + 1}` : "Web chiếu tiếng Việt";
          }
          note = detected || "Link phụ đề/thuyết minh";
        }

        return { url: entry.url, label, note };
      });
    }

    function getChineseWatchLinks(show) {
      return getWatchLinksByType(show, "chinese");
    }

    function getVietnameseWatchLinks(show) {
      return getWatchLinksByType(show, "vietnamese");
    }

    function collectWatchLinksFromItem(item, type) {
      return [...item.querySelectorAll(`.watch-link-row[data-watch-link-type="${type}"]`)]
        .map(row => {
          const url = row.querySelector(`input[data-watch-link-url-type="${type}"]`)?.value.trim() || "";
          const label = row.querySelector(`input[data-watch-link-label-type="${type}"]`)?.value.trim() || "";
          if (!url) return null;
          return label ? { url, label } : { url };
        })
        .filter(Boolean);
    }

    function applyWatchLinksToData(data, item) {
      const chineseLinks = collectWatchLinksFromItem(item, "chinese");
      const vietnameseLinks = collectWatchLinksFromItem(item, "vietnamese");

      if (chineseLinks.length) {
        data.chineseWatchUrls = chineseLinks;
        data.chineseWatchUrl = chineseLinks[0].url;
      } else {
        delete data.chineseWatchUrls;
        delete data.chineseWatchUrl;
      }

      if (vietnameseLinks.length) {
        data.vietnameseWatchUrls = vietnameseLinks;
        data.vietnameseWatchUrl = vietnameseLinks[0].url;
      } else {
        delete data.vietnameseWatchUrls;
        delete data.vietnameseWatchUrl;
      }

      return data;
    }

    function renderWatchLinkRow(index, type, link = { url: "", label: "" }, canRemove = true) {
      const labelPlaceholder = type === "chinese"
        ? "Tên hiển thị (VD: Tencent, Mango TV...)"
        : "Tên hiển thị (VD: FPT Play, VieON, YouTube...)";

      return `
        <div class="watch-link-row" data-watch-link-type="${type}">
          <input class="settings-input watch-link-label-input" type="text" data-watch-link-label-type="${type}" placeholder="${labelPlaceholder}" value="${escapeHtml(link.label || "")}" ${settingsLocked ? "disabled" : ""}>
          <div class="watch-link-url-line">
            <input class="settings-input watch-link-input" type="url" data-watch-link-url-type="${type}" placeholder="https://..." value="${escapeHtml(link.url || "")}" ${settingsLocked ? "disabled" : ""}>
            <div class="watch-link-actions">
              <button type="button" class="watch-link-move-btn" onclick="moveWatchLinkRow(this, 'up')" title="Di chuyển lên" ${settingsLocked ? "disabled" : ""}>
                <i class="fa-solid fa-arrow-up"></i>
              </button>
              <button type="button" class="watch-link-move-btn" onclick="moveWatchLinkRow(this, 'down')" title="Di chuyển xuống" ${settingsLocked ? "disabled" : ""}>
                <i class="fa-solid fa-arrow-down"></i>
              </button>
              <button type="button" class="watch-link-remove-btn" onclick="removeWatchLinkRow(this)" title="Xóa link" ${(canRemove && !settingsLocked) ? "" : "disabled"}>
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function moveWatchLinkRow(button, direction) {
      if (settingsLocked) return;
      const row = button.closest(".watch-link-row");
      if (!row) return;

      const parent = row.parentElement;
      if (direction === "up") {
        const prev = row.previousElementSibling;
        if (prev && prev.classList.contains("watch-link-row")) {
          parent.insertBefore(row, prev);
        }
      } else if (direction === "down") {
        const next = row.nextElementSibling;
        if (next && next.classList.contains("watch-link-row")) {
          parent.insertBefore(next, row);
        }
      }
    }

    function updateWatchLinkRemoveButtons(editor) {
      if (!editor) return;
      const rows = editor.querySelectorAll(".watch-link-row");
      rows.forEach(row => {
        const removeBtn = row.querySelector(".watch-link-remove-btn");
        if (removeBtn) removeBtn.disabled = settingsLocked || rows.length <= 1;
      });
    }

    function addWatchLinkRow(index, type) {
      if (settingsLocked) return;

      const editor = document.getElementById(`watch-links-${index}-${type}`);
      if (!editor) return;

      const temp = document.createElement("div");
      temp.innerHTML = renderWatchLinkRow(index, type, { url: "", label: "" }, true);
      const row = temp.firstElementChild;
      editor.appendChild(row);
      updateWatchLinkRemoveButtons(editor);
      row.querySelector(`input[data-watch-link-label-type="${type}"]`)?.focus();
    }

    function removeWatchLinkRow(button) {
      if (settingsLocked) return;

      const row = button.closest(".watch-link-row");
      const editor = row?.parentElement;
      if (!row || !editor) return;

      if (editor.querySelectorAll(".watch-link-row").length <= 1) {
        row.querySelectorAll("input").forEach(input => { input.value = ""; });
        return;
      }

      row.remove();
      updateWatchLinkRemoveButtons(editor);
    }

    function compareShowsByRatingAndName(a, b) {
      const nameA = removeVietnameseTones((a.vietnamese || "").toLowerCase());
      const nameB = removeVietnameseTones((b.vietnamese || "").toLowerCase());
      return nameA.localeCompare(nameB, "vi");
    }

    function renderStarDisplay(rating) {
      const stars = getShowRating({ rating });
      if (!stars) return "";
      const icons = Array.from({ length: 5 }, (_, index) => {
        const filled = index < stars;
        return `<i class="fa-${filled ? "solid" : "regular"} fa-star"></i>`;
      }).join("");
      return `<span class="show-rating" title="Đánh giá ${stars}/5">${icons}</span>`;
    }

    function updateStarPickerVisual(picker, rating) {
      if (!picker) return;
      picker.querySelectorAll(".star-btn").forEach((button, starIndex) => {
        const active = starIndex + 1 <= rating;
        button.classList.toggle("active", active);
        const icon = button.querySelector("i");
        if (icon) icon.className = `fa-${active ? "solid" : "regular"} fa-star`;
      });
    }

    function syncRatingPickers(index, rating) {
      const hiddenInput = document.getElementById(`settings-${index}-rating`);
      if (hiddenInput) hiddenInput.value = String(rating);
      document.querySelectorAll(`[data-rating-index="${index}"]`).forEach(picker => {
        updateStarPickerVisual(picker, rating);
      });
      const modalSlot = document.getElementById("modal-rating-slot");
      if (modalSlot && currentModalIndex === index) {
        modalSlot.innerHTML = renderInteractiveStarRating(index, rating);
      }
    }

    function renderInteractiveStarRating(index, rating) {
      const current = getShowRating({ rating });
      const stars = Array.from({ length: 5 }, (_, starIndex) => {
        const value = starIndex + 1;
        const active = value <= current;
        const clearHint = value === current && current > 0 ? " (bấm lại để xóa)" : "";
        return `<button type="button" class="star-btn ${active ? "active" : ""}" data-star-value="${value}" onclick="event.stopPropagation(); saveShowRating(${index}, ${value})" title="${value} sao${clearHint}"><i class="fa-${active ? "solid" : "regular"} fa-star"></i></button>`;
      }).join("");

      return `
        <div class="interactive-rating card-rating-picker" data-rating-index="${index}" onclick="event.stopPropagation()">
          <span class="interactive-rating-label">Đánh giá</span>
          ${stars}
        </div>
      `;
    }

    function saveShowRating(index, value) {
      const resolved = resolveShowIndex(index);
      if (!resolved) return;

      let rating = Math.min(5, Math.max(0, parseInt(value, 10) || 0));
      const currentShow = getEffectiveShows().find(show => show._index === index);
      const currentRating = getShowRating(currentShow || {});

      if (rating > 0 && rating === currentRating) {
        rating = 0;
      }

      if (resolved.isCustom) {
        const updated = { ...customShows[resolved.customIndex] };
        if (rating > 0) updated.rating = rating;
        else delete updated.rating;
        customShows[resolved.customIndex] = updated;
        saveCustomShows();
      } else {
        const key = getShowKey(resolved.baseShow);
        const baseIndex = findShowsDataIndexByKey(key);
        if (baseIndex >= 0) {
          if (rating > 0) showsData[baseIndex].rating = rating;
          else delete showsData[baseIndex].rating;
        }
      }

      syncRatingPickers(index, rating);
      updateStatistics();
      renderShows();

      const showName = currentShow?.vietnamese || "show";
      if (rating > 0) {
        showToast(`Đã đánh giá "${showName}" ${rating} sao`);
      } else {
        showToast(`Đã xóa đánh giá của "${showName}"`);
      }
    }

    function getShowWithUserData(show) {
      return { ...show };
    }

    function getShowImage(show) {
      return show.image || show.poster || show.posterUrl || "";
    }

    function getShowYear(show) {
      const directYear = show.year || show.releaseYear || show.airYear || show.premiereYear;
      if (directYear) return String(directYear);

      const text = [show.time, show.releaseDate, show.airDate, show.premiereDate].filter(Boolean).join(" ");
      const match = text.match(/\b(19|20)\d{2}\b/);
      return match ? match[0] : "";
    }

    function getEffectiveShows() {
      return getAllShowsRaw().map((show, index) => ({
        ...getShowWithUserData(show),
        _index: index,
        _isCustom: !!show._isCustom
      }));
    }

    function collectSettingsFields(item) {
      const data = {};
      item.querySelectorAll("[data-field]").forEach(input => {
        const field = input.getAttribute("data-field");
        const value = input.value.trim();

        if (field === "tags") {
          data.tags = stringToTags(value);
          return;
        }

        if (field === "rating") {
          const rating = Math.min(5, Math.max(0, parseInt(value, 10) || 0));
          if (rating > 0) data.rating = rating;
          return;
        }

        if (value) {
          data[field] = value;
        }
      });
      return data;
    }

    // Calculate and render overall Statistics on load
    function updateStatistics() {
      const effectiveShows = getEffectiveShows();
      const total = effectiveShows.length;
      const upcoming = effectiveShows.filter(s => s.status === "upcoming").length;
      const airing = effectiveShows.filter(s => s.status === "airing").length;
      const completed = effectiveShows.filter(s => s.status === "completed").length;

      document.getElementById("stat-total").innerText = total;
      document.getElementById("stat-upcoming").innerText = upcoming;
      document.getElementById("stat-airing").innerText = airing;
      document.getElementById("stat-completed").innerText = completed;
    }

    // Copy to clipboard helper
    function copyToClipboard(text, buttonElement, message = "Đã sao chép!") {
      navigator.clipboard.writeText(text).then(() => {
        // Visual feedback on button
        const originalHtml = buttonElement.innerHTML;
        buttonElement.classList.add("success");
        buttonElement.innerHTML = '<i class="fa-solid fa-check"></i>';
        
        showToast(`${message}: "${text}"`);

        setTimeout(() => {
          buttonElement.classList.remove("success");
          buttonElement.innerHTML = originalHtml;
        }, 1500);
      }).catch(err => {
        showToast("Không thể sao chép! Lỗi hệ thống.", true);
        console.error("Lỗi copy: ", err);
      });
    }

    // Display Toast Notification
    function showToast(msg, isError = false) {
      const container = document.getElementById("toast-container");
      const toast = document.createElement("div");
      toast.className = "toast";
      if (isError) {
        toast.style.borderColor = "#ef4444";
        toast.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i> <span>${msg}</span>`;
      } else {
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${msg}</span>`;
      }
      
      container.appendChild(toast);
      
      // Animate in
      setTimeout(() => toast.classList.add("show"), 50);
      
      // Auto remove after 2.8s
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
      }, 2800);
    }

    // Get Platform css class based on name
    function getPlatformClass(platform) {
      if (!platform) return "undecided";
      const lower = platform.toLowerCase();
      if (lower.includes("tencent") || lower.includes("qq")) return "tencent";
      if (lower.includes("mango") || lower.includes("mgtv")) return "mango";
      if (lower.includes("youku")) return "youku";
      if (lower.includes("iqiyi")) return "iqiyi";
      if (lower.includes("bilibili")) return "bilibili";
      if (lower.includes("migu")) return "migu";
      if (lower.includes("tvb")) return "tvb";
      if (lower.includes("gaga")) return "gaga";
      return "undecided";
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function renderAdminDetailDisplay(show) {
      const displayEl = document.getElementById("admin-detail-display");
      const items = [];

      if (show.episodeProgress) {
        items.push(`
          <div class="admin-detail-item">
            <span class="admin-detail-item-label">Đang chiếu đến tập</span>
            <div class="admin-detail-item-value">${escapeHtml(show.episodeProgress)}</div>
          </div>
        `);
      }
      if (show.airingNote) {
        items.push(`
          <div class="admin-detail-item">
            <span class="admin-detail-item-label">Ghi chú phát sóng</span>
            <div class="admin-detail-item-value">${escapeHtml(show.airingNote)}</div>
          </div>
        `);
      }
      if (show.detailNotes) {
        items.push(`
          <div class="admin-detail-item">
            <span class="admin-detail-item-label">Ghi chú chi tiết khác</span>
            <div class="admin-detail-item-value">${escapeHtml(show.detailNotes)}</div>
          </div>
        `);
      }

      displayEl.innerHTML = items.length
        ? items.join("")
        : '<p class="admin-detail-empty">Chưa có thông tin chi tiết. Mở <strong>Cài đặt chung</strong> để chỉnh sửa.</p>';
    }

    function applyUserEditableFields(show) {
      const description = show.description && show.description.trim() ? show.description.trim() : getShowDescription(show);
      const detailsHtml = renderDetailUpdates(show);
      document.getElementById("modal-desc-el").innerHTML = `${escapeHtml(description)}${detailsHtml}`;
      renderShowPoster(show);
      renderShowLinks(show);
      renderAdminDetailDisplay(show);
    }

    function renderDetailUpdates(show) {
      const chips = [];
      if (show.episodeProgress) {
        chips.push(`<span class="detail-info-chip"><i class="fa-solid fa-tv"></i>${escapeHtml(show.episodeProgress)}</span>`);
      }
      if (show.airingNote) {
        chips.push(`<span class="detail-info-chip"><i class="fa-solid fa-clock"></i>${escapeHtml(show.airingNote)}</span>`);
      }

      const notesHtml = show.detailNotes ? `
        <div class="couple-updates-section">
          <div class="couple-updates-title"><i class="fa-solid fa-note-sticky"></i> Ghi chú cập nhật</div>
          <div class="couple-updates-content">${escapeHtml(show.detailNotes)}</div>
        </div>
      ` : "";

      if (!chips.length && !notesHtml) return "";
      return `
        ${chips.length ? `<div class="detail-info-bar">${chips.join("")}</div>` : ""}
        ${notesHtml}
      `;
    }

    function exportUserDataStore() {
      const json = JSON.stringify({
        showsData,
        hiddenShows: loadHiddenShowKeys()
      }, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        showToast("Đã copy JSON showsData hiện tại");
      }).catch(err => {
        console.error("Không copy được dữ liệu chỉnh sửa:", err);
        showToast("Không copy được JSON. Hãy mở DevTools để lấy localStorage.", true);
      });
    }

    function getPersistableShowsData() {
      const hidden = new Set(loadHiddenShowKeys());
      return showsData
        .filter(show => !hidden.has(getShowKey(show)))
        .map(show => cleanRuntimeFields(show));
    }

    function downloadUpdatedJson() {
      const json = JSON.stringify(getPersistableShowsData(), null, 2) + "\n";
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      link.href = url;
      link.download = `showsData_updated_${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Da tao file showsData.json moi");
    }

    function statusLabel(status) {
      if (status === "upcoming") return "Sắp chiếu";
      if (status === "airing") return "Đang chiếu";
      return "Đã xong";
    }

    function tagToString(tags) {
      return Array.isArray(tags) ? tags.join(",") : (tags || "normal");
    }

    function stringToTags(value) {
      const tags = String(value || "normal")
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);
      return tags.length ? tags : ["normal"];
    }

    function matchesSettingsSearch(show, query) {
      const normalizedQuery = removeVietnameseTones(String(query || "").toLowerCase().trim());
      if (!normalizedQuery) return true;

      const searchable = [
        show.chinese,
        show.english,
        show.vietnamese,
        show.platform,
        show.time,
        show.episodeProgress,
        show.airingNote,
        show.coupleUpdates,
        show.detailNotes,
        show.description || getShowDescription(show),
        statusLabel(show.status),
        tagToString(show.tags),
        countryLabel(getShowCountry(show)),
        show._isCustom ? "tu them show moi" : ""
      ].join(" ");

      const raw = searchable.toLowerCase();
      const rawNoTone = removeVietnameseTones(raw);
      return raw.includes(normalizedQuery) || rawNoTone.includes(normalizedQuery);
    }

    function openSettingsModal() {
      settingsLocked = true;
      settingsSearchQuery = "";
      const settingsSearchBox = document.getElementById("settings-search-box");
      if (settingsSearchBox) settingsSearchBox.value = "";
      renderSettingsList();
      updateSettingsLockState();
      document.getElementById("settings-modal").classList.add("active");
      document.body.style.overflow = "hidden";
      settingsSearchBox?.focus();
    }

    function closeSettingsModal() {
      document.getElementById("settings-modal").classList.remove("active");
      document.body.style.overflow = "";
    }

    function toggleSettingsLock() {
      settingsLocked = !settingsLocked;
      updateSettingsLockState();
    }

    function updateSettingsLockState() {
      const lockBtn = document.getElementById("settings-lock-btn");
      if (!lockBtn) return;

      lockBtn.classList.toggle("locked", settingsLocked);
      lockBtn.innerHTML = settingsLocked
        ? '<i class="fa-solid fa-lock"></i> Đang khóa'
        : '<i class="fa-solid fa-unlock"></i> Đang mở khóa';

      document.querySelectorAll(".settings-input, .settings-select, .settings-textarea").forEach(input => {
        input.disabled = settingsLocked;
      });
      document.querySelectorAll(".settings-save-btn, .settings-delete-btn[data-delete-show]").forEach(button => {
        button.disabled = settingsLocked;
      });
      const addBtn = document.getElementById("settings-add-show-btn");
      if (addBtn) addBtn.disabled = settingsLocked;
      document.querySelectorAll(".watch-link-label-input, .watch-link-input, .watch-link-add-btn, .watch-link-remove-btn, .watch-link-move-btn").forEach(button => {
        button.disabled = settingsLocked;
      });
      document.querySelectorAll(".watch-links-editor").forEach(editor => {
        updateWatchLinkRemoveButtons(editor);
      });
    }

    function renderSettingsList() {
      const list = document.getElementById("settings-list");
      const meta = document.getElementById("settings-search-meta");
      const openIndices = new Set(
        [...document.querySelectorAll(".settings-show-item.open")].map(item => item.getAttribute("data-settings-index"))
      );
      const sortedShows = [...getEffectiveShows()].sort(compareShowsByRatingAndName);
      const query = settingsSearchQuery.trim();
      const filtered = sortedShows.filter(show => matchesSettingsSearch(show, query));

      if (meta) {
        meta.textContent = query
          ? `Hiển thị ${filtered.length} / ${sortedShows.length} show`
          : `${sortedShows.length} show`;
      }

      if (!filtered.length) {
        list.innerHTML = `
          <div class="settings-empty-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <h4>Không tìm thấy show</h4>
            <p>Thử từ khóa khác hoặc xóa nội dung ô tìm kiếm.</p>
          </div>
        `;
        updateSettingsLockState();
        return;
      }

      list.innerHTML = filtered.map(show => {
        const thumbUrl = getShowImage(show);
        const thumbHtml = thumbUrl
          ? `<img src="${escapeHtml(thumbUrl)}" alt="Ảnh ${escapeHtml(show.vietnamese)}">`
          : `<i class="fa-regular fa-image"></i>`;
        const customBadge = show._isCustom ? `<span class="badge-custom">Tự thêm</span>` : "";
        const ratingHtml = renderStarDisplay(getShowRating(show));

        return `
          <div class="settings-show-item" data-settings-index="${show._index}">
            <div class="settings-show-header" onclick="toggleSettingsShow(${show._index})">
              <div class="settings-show-thumb">${thumbHtml}</div>
              <div class="settings-show-name">
                <div class="settings-show-name-zh">${escapeHtml(show.chinese)}</div>
                <div class="settings-show-name-vi">${escapeHtml(show.vietnamese)}${ratingHtml}</div>
              </div>
              <div class="settings-show-badges">
                ${customBadge}
                ${renderCountryBadge(show)}
                <span class="badge badge-status ${show.status}">${statusLabel(show.status)}</span>
                <span class="badge badge-plat ${getPlatformClass(show.platform)}">${escapeHtml(show.platform)}</span>
              </div>
              <i class="fa-solid fa-chevron-down settings-expand-icon"></i>
            </div>
            <div class="settings-show-form">
              <div class="settings-show-form-inner">
                <div class="settings-form-grid">
                  ${settingsStarRating(show._index, getShowRating(show))}
                  ${settingsInput(show._index, "chinese", "Tên gốc", show.chinese)}
                  ${settingsInput(show._index, "english", "Tên tiếng Anh", show.english)}
                  ${settingsInput(show._index, "vietnamese", "Tên tiếng Việt", show.vietnamese)}
                  ${settingsSelect(show._index, "country", "Quốc gia / Vùng", getShowCountry(show), COUNTRY_OPTIONS.map(option => [option.code, `${option.flag} ${option.label}`]))}
                  ${settingsSelect(show._index, "status", "Trạng thái", show.status, [
                    ["upcoming", "Sắp chiếu"],
                    ["airing", "Đang chiếu"],
                    ["completed", "Đã kết thúc"]
                  ])}
                  ${settingsInput(show._index, "year", "Năm phát hành", getShowYear(show))}
                  ${settingsInput(show._index, "platform", "Nhà phát hành / Nền tảng", show.platform || "")}
                  ${settingsInput(show._index, "time", "Thời gian/Lịch chiếu", show.time || "")}
                  ${settingsInput(show._index, "tags", "Tags", tagToString(show.tags))}
                  ${settingsInput(show._index, "image", "Link hình ảnh", getShowImage(show), "span-2")}
                  ${settingsWatchLinksGroup(show._index, "chinese", getChineseWatchLinks(show), "Link xem tiếng Trung")}
                  ${settingsWatchLinksGroup(show._index, "vietnamese", getVietnameseWatchLinks(show), "Link xem tiếng Việt")}
                  ${settingsInput(show._index, "episodeProgress", "Đang chiếu đến tập", show.episodeProgress || "")}
                  ${settingsInput(show._index, "airingNote", "Ghi chú phát sóng", show.airingNote || "", "span-2")}
                  ${settingsTextarea(show._index, "description", "Mô tả show", show.description || getShowDescription(show), "span-3")}
                  ${settingsTextarea(show._index, "coupleUpdates", "Tình hình các cặp đôi sau show", show.coupleUpdates || "", "span-3")}
                  ${settingsTextarea(show._index, "detailNotes", "Ghi chú chi tiết khác", show.detailNotes || "", "span-3")}
                </div>
                <div class="settings-show-actions">
                  <button class="settings-save-btn" type="button" onclick="saveSettingsShow(${show._index})">
                    <i class="fa-solid fa-floppy-disk"></i> Lưu show này
                  </button>
                  <button class="settings-delete-btn" data-delete-show type="button" onclick="deleteShow(${show._index})">
                    <i class="fa-solid fa-trash"></i> Xóa show
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      openIndices.forEach(index => {
        document.querySelector(`[data-settings-index="${index}"]`)?.classList.add("open");
      });
      updateSettingsLockState();
    }

    function settingsStarRating(index, rating) {
      const current = getShowRating({ rating });
      const stars = Array.from({ length: 5 }, (_, starIndex) => {
        const value = starIndex + 1;
        const active = value <= current;
        return `<button type="button" class="star-btn ${active ? "active" : ""}" data-star-value="${value}" onclick="setSettingsRating(${index}, ${value})" title="${value} sao"><i class="fa-${active ? "solid" : "regular"} fa-star"></i></button>`;
      }).join("");

      return `
        <div class="settings-field span-3">
          <label for="settings-${index}-rating">Đánh giá sao</label>
          <div class="star-rating-picker" data-rating-index="${index}">
            <input type="hidden" class="settings-input" id="settings-${index}-rating" data-field="rating" value="${current}">
            ${stars}
            <button type="button" class="star-clear-btn" onclick="setSettingsRating(${index}, 0)">Xóa sao</button>
          </div>
        </div>
      `;
    }

    function setSettingsRating(index, value) {
      saveShowRating(index, value);
    }

    function addNewShow() {
      if (settingsLocked) {
        showToast("Mở khóa cài đặt trước khi thêm show mới", true);
        return;
      }

      const newShow = {
        chinese: "Tên show mới",
        english: "New Show",
        vietnamese: "Show mới",
        status: "upcoming",
        platform: "TBA",
        time: "",
        image: "",
        chineseWatchUrl: "",
        vietnameseWatchUrl: "",
        chineseWatchUrls: [],
        vietnameseWatchUrls: [],
        tags: ["normal"],
        country: "china",
        rating: 0,
        description: ""
      };

      showsData.push(newShow);
      settingsSearchQuery = "";
      const settingsSearchBox = document.getElementById("settings-search-box");
      if (settingsSearchBox) settingsSearchBox.value = "";
      updateStatistics();
      renderShows();
      renderSettingsList();

      const newIndex = getAllShowsRaw().length - 1;
      const newItem = document.querySelector(`[data-settings-index="${newIndex}"]`);
      newItem?.classList.add("open");
      newItem?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      showToast("Đã thêm show mới. Điền thông tin và bấm Lưu show này.");
    }

    function settingsInput(index, field, label, value, spanClass = "") {
      return `
        <div class="settings-field ${spanClass}">
          <label for="settings-${index}-${field}">${label}</label>
          <input class="settings-input" id="settings-${index}-${field}" data-field="${field}" value="${escapeHtml(value || "")}">
        </div>
      `;
    }

    function settingsSelect(index, field, label, value, options) {
      return `
        <div class="settings-field">
          <label for="settings-${index}-${field}">${label}</label>
          <select class="settings-select" id="settings-${index}-${field}" data-field="${field}">
            ${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${optionLabel}</option>`).join("")}
          </select>
        </div>
      `;
    }

    function settingsTextarea(index, field, label, value, spanClass = "") {
      return `
        <div class="settings-field ${spanClass}">
          <label for="settings-${index}-${field}">${label}</label>
          <textarea class="settings-textarea" id="settings-${index}-${field}" data-field="${field}">${escapeHtml(value || "")}</textarea>
        </div>
      `;
    }

    function settingsWatchLinksGroup(index, type, links, label, spanClass = "span-2") {
      const linkList = links.length ? links : [{ url: "", label: "" }];
      const rows = linkList.map((link, rowIndex) =>
        renderWatchLinkRow(index, type, link, linkList.length > 1)
      ).join("");

      return `
        <div class="settings-field ${spanClass}" data-watch-link-group="${type}">
          <label>${label}</label>
          <div class="watch-links-editor" id="watch-links-${index}-${type}">
            ${rows}
          </div>
          <button type="button" class="watch-link-add-btn" onclick="addWatchLinkRow(${index}, '${type}')">
            <i class="fa-solid fa-plus"></i> Thêm link
          </button>
        </div>
      `;
    }

    function toggleSettingsShow(index) {
      const item = document.querySelector(`[data-settings-index="${index}"]`);
      if (item) item.classList.toggle("open");
    }

    function saveSettingsShow(index) {
      if (settingsLocked) return;

      const resolved = resolveShowIndex(index);
      if (!resolved) return;

      const item = document.querySelector(`[data-settings-index="${index}"]`);
      if (!item) return;

      const collected = collectSettingsFields(item);

      if (resolved.isCustom) {
        const updated = {
          ...customShows[resolved.customIndex],
          ...collected,
          _customId: customShows[resolved.customIndex]._customId
        };

        item.querySelectorAll("[data-field]").forEach(input => {
          const field = input.getAttribute("data-field");
          const value = input.value.trim();

          if (field === "rating") {
            if (!(parseInt(value, 10) > 0)) delete updated.rating;
            return;
          }

          if (field === "tags") {
            updated.tags = stringToTags(value);
            return;
          }

          if (!value) {
            delete updated[field];
          } else {
            updated[field] = value;
          }
        });

        applyWatchLinksToData(updated, item);
        customShows[resolved.customIndex] = updated;
        saveCustomShows();
      } else {
        const key = getShowKey(resolved.baseShow);
        const baseIndex = findShowsDataIndexByKey(key);
        if (baseIndex < 0) return;
        const data = { ...showsData[baseIndex], ...collected };

        item.querySelectorAll("[data-field]").forEach(input => {
          const field = input.getAttribute("data-field");
          const value = input.value.trim();

          if (field === "rating") {
            if (!(parseInt(value, 10) > 0)) delete data.rating;
            return;
          }

          if (field === "tags") {
            data.tags = stringToTags(value);
            return;
          }

          if (!value) {
            delete data[field];
          } else {
            data[field] = value;
          }
        });

        applyWatchLinksToData(data, item);
        showsData[baseIndex] = data;
      }

      updateStatistics();
      renderShows();
      renderSettingsList();
      document.querySelector(`[data-settings-index="${index}"]`)?.classList.add("open");
      const savedShow = getEffectiveShows().find(show => show._index === index);
      showToast(`Đã lưu chỉnh sửa cho "${savedShow?.vietnamese || "show"}"`);
    }

    function deleteShow(index) {
      const resolved = resolveShowIndex(index);
      if (!resolved) return;

      const show = getShowWithUserData(resolved.baseShow);
      const showName = show.vietnamese || show.chinese || "show";
      const confirmMessage = `Xóa vĩnh viễn "${showName}" khỏi danh sách hiện tại? Nếu muốn giữ thay đổi này trong file, hãy bấm "Tải HTML đã cập nhật" sau khi xóa.`;

      if (!window.confirm(confirmMessage)) return;

      const key = getShowKey(resolved.baseShow);
      const baseIndex = findShowsDataIndexByKey(key);
      if (baseIndex >= 0) {
        showsData.splice(baseIndex, 1);
      }

      if (currentModalIndex === index) {
        closeShowModal();
        currentModalIndex = null;
      }

      const settingsModal = document.getElementById("settings-modal");
      if (settingsModal.classList.contains("active")) {
        renderSettingsList();
      }

      updateStatistics();
      renderShows();
      showToast(`Đã xóa "${showName}" khỏi danh sách`);
    }

    function openSettingsForShow(index) {
      const show = getEffectiveShows().find(item => item._index === index);
      if (!show) return;

      closeShowModal();
      currentModalIndex = null;

      settingsLocked = false;
      settingsSearchQuery = show.vietnamese || show.chinese || "";
      const settingsSearchBox = document.getElementById("settings-search-box");
      if (settingsSearchBox) settingsSearchBox.value = settingsSearchQuery;

      renderSettingsList();
      updateSettingsLockState();
      document.getElementById("settings-modal").classList.add("active");
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        const item = document.querySelector(`[data-settings-index="${index}"]`);
        item?.classList.add("open");
        item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      showToast(`Đang chỉnh sửa "${show.vietnamese}"`);
    }

    function openSettingsForShowFromModal() {
      if (currentModalIndex === null) return;
      openSettingsForShow(currentModalIndex);
    }

    function deleteShowFromModal() {
      if (currentModalIndex === null) return;
      deleteShow(currentModalIndex);
    }

    function renderShowPoster(show) {
      const posterUrl = show.image || show.poster || show.posterUrl || "";
      const posterEl = document.getElementById("modal-poster-el");

      if (posterUrl) {
        posterEl.innerHTML = `<img src="${escapeHtml(posterUrl)}" alt="Ảnh show ${escapeHtml(show.vietnamese)}" loading="lazy">`;
        return;
      }

      posterEl.innerHTML = `
        <div class="modal-poster-placeholder">
          <i class="fa-regular fa-image"></i>
          <div>Chưa có ảnh show</div>
          <small>Có thể thêm trường <strong>image</strong> vào dữ liệu show.</small>
        </div>
      `;
    }

    function renderShowLinks(show) {
      const viLinks = getVietnameseWatchLinks(show);
      const zhLinks = getChineseWatchLinks(show);

      // Support custom non-categorized watch links if any exist in data
      if (Array.isArray(show.watchLinks)) {
        show.watchLinks.forEach(link => {
          const detected = detectPlatformFromUrl(link.url);
          const formatted = {
            label: link.label || "Link xem show",
            url: link.url,
            note: link.note || detected
          };
          // Try to classify into Vietnamese or Chinese based on notes/labels, fallback to Vietnamese
          const lowerLabel = formatted.label.toLowerCase();
          const lowerNote = (formatted.note || "").toLowerCase();
          if (lowerLabel.includes("trung") || lowerNote.includes("trung") || lowerNote.includes("origin")) {
            zhLinks.push(formatted);
          } else {
            viLinks.push(formatted);
          }
        });
      }

      const linksEl = document.getElementById("modal-links-el");
      const summaryEl = document.getElementById("modal-links-summary");

      const totalLinks = viLinks.length + zhLinks.length;

      if (summaryEl) {
        summaryEl.textContent = totalLinks > 0
          ? `${totalLinks} link`
          : "Chưa có link";
      }

      if (totalLinks === 0) {
        linksEl.innerHTML = `
          <div class="watch-link-item placeholder">
            <div>
              <span class="watch-link-label">Web chiếu tiếng Việt</span>
              <span class="watch-link-note">Chưa thêm link</span>
            </div>
            <i class="fa-solid fa-closed-captioning"></i>
          </div>
          <div class="watch-link-item placeholder">
            <div>
              <span class="watch-link-label">Nơi chiếu tiếng Trung</span>
              <span class="watch-link-note">Chưa thêm link</span>
            </div>
            <i class="fa-solid fa-link"></i>
          </div>
        `;
        return;
      }

      let html = "";

      // 1. Render Vietnamese Watch Links (Priority 1)
      if (viLinks.length > 0) {
        html += `<div class="modal-links-section-title"><i class="fa-solid fa-closed-captioning" style="color: var(--accent-color);"></i> Bản Vietsub / Thuyết minh</div>`;
        html += `<div class="modal-links-list">`;
        html += viLinks.map(link => `
          <a class="watch-link-item" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            <div>
              <span class="watch-link-label">${escapeHtml(link.label || "Link xem tiếng Việt")}</span>
              ${link.note ? `<span class="watch-link-note">${escapeHtml(link.note)}</span>` : ""}
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        `).join("");
        html += `</div>`;
      }

      // 2. Render Chinese Watch Links (Priority 2)
      if (zhLinks.length > 0) {
        const spacingClass = viLinks.length > 0 ? "style='margin-top: 1.25rem;'" : "";
        html += `<div class="modal-links-section-title" ${spacingClass}><i class="fa-solid fa-earth-asia" style="color: var(--accent-color);"></i> Bản gốc tiếng Trung</div>`;
        html += `<div class="modal-links-list">`;
        html += zhLinks.map(link => `
          <a class="watch-link-item" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            <div>
              <span class="watch-link-label">${escapeHtml(link.label || "Link xem tiếng Trung")}</span>
              ${link.note ? `<span class="watch-link-note">${escapeHtml(link.note)}</span>` : ""}
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        `).join("");
        html += `</div>`;
      }

      linksEl.innerHTML = html;
    }

    // Modal Control Logic
    function openShowModal(index) {
      currentModalIndex = index;
      const resolved = resolveShowIndex(index);
      if (!resolved) return;
      const show = getShowWithUserData(resolved.baseShow);
      const modal = document.getElementById("show-modal");
      const container = document.getElementById("modal-container-el");
      const adminSection = document.querySelector(".modal-admin-section");
      const adminToggle = document.getElementById("admin-toggle-btn");
      const linksCard = document.getElementById("modal-links-card");
      const linksToggle = document.getElementById("modal-links-toggle");
      adminSection.classList.remove("open");
      adminToggle.setAttribute("aria-expanded", "false");
      linksCard.classList.remove("open");
      linksToggle.setAttribute("aria-expanded", "false");
      
      // Set platform class for dynamic colors
      container.setAttribute("data-plat", getPlatformClass(show.platform));
      
      // Set values
      document.getElementById("modal-title-el").innerText = show.vietnamese;
      document.getElementById("modal-zh-el").innerText = show.chinese;
      document.getElementById("modal-en-el").innerText = show.english;
      document.getElementById("modal-vi-el").innerText = show.vietnamese;
      applyUserEditableFields(show);
      
      // Render badges inside modal
      let statusText = "Đã xong";
      if (show.status === "upcoming") statusText = "Sắp chiếu";
      if (show.status === "airing") statusText = "Đang chiếu";
      
      let tagBadgeHtml = "";
      if (show.tags.includes("all-female")) {
        tagBadgeHtml = `<span class="badge badge-tag"><i class="fa-solid fa-venus-double"></i> Toàn Nữ (GL)</span>`;
      } else if (show.tags.includes("all-male")) {
        tagBadgeHtml = `<span class="badge badge-tag"><i class="fa-solid fa-mars-double"></i> Toàn Nam (BL)</span>`;
      }

      const timeHtml = show.time ? `<span class="time-note"><i class="fa-solid fa-clock"></i> ${show.time}</span>` : "";
      const year = getShowYear(show);
      const yearHtml = year ? `<span class="badge badge-year"><i class="fa-regular fa-calendar"></i> ${escapeHtml(year)}</span>` : "";

      document.getElementById("modal-badges-el").innerHTML = `
        ${renderCountryBadge(show)}
        <span class="badge badge-status ${show.status}">${statusText}</span>
        <span class="badge badge-plat ${getPlatformClass(show.platform)}">${show.platform}</span>
        ${yearHtml}
        ${tagBadgeHtml}
        ${timeHtml}
      `;
      document.getElementById("modal-rating-slot").innerHTML = renderInteractiveStarRating(index, getShowRating(show));
      
      // Attach click events to copy buttons inside modal
      const btnZh = document.getElementById("modal-copy-zh-btn");
      const btnEn = document.getElementById("modal-copy-en-btn");
      const btnVi = document.getElementById("modal-copy-vi-btn");

      btnZh.onclick = (e) => copyToClipboard(show.chinese, btnZh, "Đã copy tên gốc");
      btnEn.onclick = (e) => copyToClipboard(show.english, btnEn, "Đã copy tên Anh");
      btnVi.onclick = (e) => copyToClipboard(show.vietnamese, btnVi, "Đã copy tên Việt");

      // Show modal with animation
      modal.classList.add("active");
      document.body.style.overflow = "hidden"; // Disable background scrolling
    }

    function closeShowModal() {
      const modal = document.getElementById("show-modal");
      modal.classList.remove("active");
      document.body.style.overflow = ""; // Re-enable background scrolling
    }

    // Filter and Render Shows
    function renderShows() {
      const grid = document.getElementById("show-cards-grid");
      grid.innerHTML = "";

      const query = removeVietnameseTones(currentFilters.search.toLowerCase().trim());
      
      const filtered = getEffectiveShows().filter(show => {
        // Status Filter
        if (currentFilters.status !== "all" && show.status !== currentFilters.status) {
          return false;
        }

        if (currentFilters.country !== "all" && getShowCountry(show) !== currentFilters.country) {
          return false;
        }

        // Tag Filter
        if (currentFilters.tag !== "all") {
          if (currentFilters.tag === "normal" && ((show.tags || []).includes("all-female") || (show.tags || []).includes("all-male"))) {
            return false;
          }
          if (currentFilters.tag === "all-female" && !(show.tags || []).includes("all-female")) {
            return false;
          }
          if (currentFilters.tag === "all-male" && !(show.tags || []).includes("all-male")) {
            return false;
          }
        }

        // Search Query filter
        if (query !== "") {
          const rawZh = (show.chinese || "").toLowerCase();
          const rawEn = (show.english || "").toLowerCase();
          const rawVi = (show.vietnamese || "").toLowerCase();
          const rawViNoTone = removeVietnameseTones(rawVi);
          const rawPlat = (show.platform || "").toLowerCase();
          const rawCountry = countryLabel(getShowCountry(show)).toLowerCase();
          const rawCountryNoTone = removeVietnameseTones(rawCountry);
          const rawTime = `${show.time || ""} ${show.episodeProgress || ""} ${show.airingNote || ""}`.toLowerCase();
          const rawTimeNoTone = removeVietnameseTones(rawTime);

          return rawZh.includes(query) || 
                 rawEn.includes(query) || 
                 rawVi.includes(query) || 
                 rawViNoTone.includes(query) ||
                 rawPlat.includes(query) ||
                 rawCountry.includes(query) ||
                 rawCountryNoTone.includes(query) ||
                 rawTime.includes(query) ||
                 rawTimeNoTone.includes(query);
        }

        return true;
      });

      filtered.sort((a, b) => {
        switch (currentFilters.sort) {
          case "stars": {
            const ratingDiff = getShowRating(b) - getShowRating(a);
            if (ratingDiff !== 0) return ratingDiff;
            return removeVietnameseTones(a.vietnamese || "").localeCompare(removeVietnameseTones(b.vietnamese || ""), "vi");
          }
          case "name-desc":
            return removeVietnameseTones(b.vietnamese || "").localeCompare(removeVietnameseTones(a.vietnamese || ""), "vi");
          case "name-en": {
            const nameEnA = (a.english || "").toLowerCase();
            const nameEnB = (b.english || "").toLowerCase();
            const enCompare = nameEnA.localeCompare(nameEnB, "en");
            if (enCompare !== 0) return enCompare;
            return removeVietnameseTones(a.vietnamese || "").localeCompare(removeVietnameseTones(b.vietnamese || ""), "vi");
          }
          case "watch-link": {
            const hasLinkA = (getChineseWatchLinks(a).length > 0 || getVietnameseWatchLinks(a).length > 0 || (Array.isArray(a.watchLinks) && a.watchLinks.length > 0)) ? 1 : 0;
            const hasLinkB = (getChineseWatchLinks(b).length > 0 || getVietnameseWatchLinks(b).length > 0 || (Array.isArray(b.watchLinks) && b.watchLinks.length > 0)) ? 1 : 0;
            if (hasLinkB !== hasLinkA) return hasLinkB - hasLinkA;
            return removeVietnameseTones(a.vietnamese || "").localeCompare(removeVietnameseTones(b.vietnamese || ""), "vi");
          }
          case "name-asc":
          default:
            return removeVietnameseTones(a.vietnamese || "").localeCompare(removeVietnameseTones(b.vietnamese || ""), "vi");
        }
      });

      if (filtered.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-face-frown"></i>
            <h3>Không tìm thấy show nào!</h3>
            <p>Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại bộ lọc.</p>
          </div>
        `;
        return;
      }

      // Generate HTML for each show card
      filtered.forEach(show => {
        const card = document.createElement("div");
        card.className = "show-card";
        card.setAttribute("data-plat", getPlatformClass(show.platform));

        // Get index in main dataset
        const originalIndex = show._index;

        // Status label mapping
        let statusText = "Đã xong";
        if (show.status === "upcoming") statusText = "Sắp chiếu";
        if (show.status === "airing") statusText = "Đang chiếu";

        // Specialized badge if present
        let tagBadgeHtml = "";
        if (show.tags.includes("all-female")) {
          tagBadgeHtml = `<span class="badge badge-tag"><i class="fa-solid fa-venus-double"></i> Toàn Nữ (GL)</span>`;
        } else if (show.tags.includes("all-male")) {
          tagBadgeHtml = `<span class="badge badge-tag"><i class="fa-solid fa-mars-double"></i> Toàn Nam (BL)</span>`;
        }

        const timeHtml = show.time ? `<span class="time-note"><i class="fa-solid fa-clock"></i> ${show.time}</span>` : "";
        const year = getShowYear(show);
        const yearHtml = year ? `<span class="badge badge-year"><i class="fa-regular fa-calendar"></i> ${escapeHtml(year)}</span>` : "";
        const ratingHtml = renderInteractiveStarRating(originalIndex, getShowRating(show));
        const thumbUrl = getShowImage(show);
        const thumbHtml = thumbUrl
          ? `<img src="${escapeHtml(thumbUrl)}" alt="Ảnh ${escapeHtml(show.vietnamese)}" loading="lazy">`
          : `<i class="fa-regular fa-image card-thumb-placeholder"></i>`;

        card.innerHTML = `
          <div>
            <div class="card-top-row">
              <div class="card-thumb">${thumbHtml}</div>
              <div class="card-top-info">
                <div class="card-header">
                  <div class="badges">
                    ${renderCountryBadge(show)}
                    <span class="badge badge-status ${show.status}">${statusText}</span>
                    <span class="badge badge-plat ${getPlatformClass(show.platform)}">${escapeHtml(show.platform)}</span>
                    ${yearHtml}
                    ${tagBadgeHtml}
                  </div>
                  ${timeHtml}
                  ${ratingHtml}
                </div>
              </div>
            </div>

            <div class="card-compact-title">
              <div class="card-title-main">${escapeHtml(show.vietnamese || show.english || show.chinese)}</div>
              <div class="card-title-sub">${escapeHtml(show.english || show.chinese)}</div>
            </div>
          </div>
          
          <button class="open-modal-btn" onclick="openShowModal(${originalIndex})" title="Mở cửa sổ chi tiết tiêu điểm show">
            <i class="fa-solid fa-up-right-from-square"></i> Xem chi tiết & Tiêu điểm
          </button>
        `;
        
        grid.appendChild(card);
      });
    }

    async function loadShowsData() {
      try {
        const response = await fetch('./showsData.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        showsData = await response.json();
        if (!Array.isArray(showsData)) throw new Error('showsData.json must contain an array');
      } catch (err) {
        console.error('Cannot load showsData.json:', err);
        showToast('Khong tai duoc showsData.json. Hay chay qua local server hoac kiem tra file du lieu.', true);
        showsData = [];
      }
    }

    function initializeAppEvents() {
      updateStatistics();
      renderShows();
      const searchBox = document.getElementById("search-box");
      searchBox.addEventListener("input", (e) => { currentFilters.search = e.target.value; renderShows(); });
      const settingsSearchBox = document.getElementById("settings-search-box");
      settingsSearchBox?.addEventListener("input", (e) => { settingsSearchQuery = e.target.value; renderSettingsList(); });
      const statusButtons = document.querySelectorAll("#status-filters .filter-btn");
      statusButtons.forEach(btn => btn.addEventListener("click", () => { statusButtons.forEach(b => b.classList.remove("active")); btn.classList.add("active"); currentFilters.status = btn.getAttribute("data-status"); renderShows(); }));
      const sortButtons = document.querySelectorAll("#sort-controls .filter-btn");
      sortButtons.forEach(btn => btn.addEventListener("click", () => { sortButtons.forEach(b => b.classList.remove("active")); btn.classList.add("active"); currentFilters.sort = btn.getAttribute("data-sort"); renderShows(); }));
      const countryButtons = document.querySelectorAll("#country-filters .filter-btn");
      countryButtons.forEach(btn => btn.addEventListener("click", () => { countryButtons.forEach(b => b.classList.remove("active")); btn.classList.add("active"); currentFilters.country = btn.getAttribute("data-country"); renderShows(); }));
      const tagButtons = document.querySelectorAll("#tag-filters .filter-btn");
      tagButtons.forEach(btn => btn.addEventListener("click", () => { tagButtons.forEach(b => b.classList.remove("active")); btn.classList.add("active"); currentFilters.tag = btn.getAttribute("data-tag"); renderShows(); }));
      document.getElementById("admin-toggle-btn").addEventListener("click", () => { const section = document.querySelector(".modal-admin-section"); const isOpen = section.classList.toggle("open"); document.getElementById("admin-toggle-btn").setAttribute("aria-expanded", String(isOpen)); });
      document.getElementById("modal-links-toggle").addEventListener("click", () => { const linksCard = document.getElementById("modal-links-card"); const isOpen = linksCard.classList.toggle("open"); document.getElementById("modal-links-toggle").setAttribute("aria-expanded", String(isOpen)); });
      const scrollBtn = document.getElementById("scroll-btn");
      window.addEventListener("scroll", () => { if (window.scrollY > 300) scrollBtn.classList.add("visible"); else scrollBtn.classList.remove("visible"); });
      scrollBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      const modal = document.getElementById("show-modal");
      modal.addEventListener("click", (e) => { if (e.target === modal) closeShowModal(); });
      const settingsModal = document.getElementById("settings-modal");
      settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettingsModal(); });
    }

    document.addEventListener("DOMContentLoaded", async () => {
      await loadShowsData();
      initializeAppEvents();
    });
