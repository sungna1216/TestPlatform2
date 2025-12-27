// modal-util.js
export function showModal(selector) {
  $(selector).css('display', 'flex');
}
export function closeModal(selector) {
  $(selector).hide();
}
