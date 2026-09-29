const { API_ORIGIN } = require("../config");

/** wx.request를 Promise로 감싼다. 서버 응답 봉투({ data } / { error })를 그대로 돌려준다. */
function post(path, body) {
  return new Promise((resolve) => {
    wx.request({
      url: `${API_ORIGIN}${path}`,
      method: "POST",
      data: body,
      header: { "content-type": "application/json" },
      timeout: 15000,
      success: (res) => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: res.data }),
      fail: () => resolve({ ok: false, status: 0, body: null }),
    });
  });
}

function login() {
  return new Promise((resolve, reject) => {
    wx.login({ success: (res) => (res.code ? resolve(res.code) : reject(new Error("no code"))), fail: reject });
  });
}

module.exports = { post, login };
