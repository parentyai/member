'use strict';

function feedbackReceived() {
  return 'City Packの誤り報告を受け付けました。確認後に反映します。';
}

function feedbackUsage() {
  return 'City Pack Feedback: <内容> の形式で送信してください。';
}

module.exports = {
  feedbackReceived,
  feedbackUsage
};
