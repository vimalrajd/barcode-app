const barcodeInput = document.getElementById('barcodeInput');
const textInput = document.getElementById('textInput');
const mrpInput = document.getElementById('mrpInput');
const showTextInBarcode = document.getElementById('showTextInBarcode');
const barcodeSvg = document.getElementById('barcode');
const topLine = document.querySelector('.top-line');

function updateLabel() {
  const value = barcodeInput.value.trim();
  const text = textInput.value.trim() || 'ITEM';
  const mrp = mrpInput.value.trim() || 'Rs. 150';
  const showText = showTextInBarcode.checked && value.length <= 18;

  topLine.textContent = `MRP: ${mrp}`;

  if (!value) {
    barcodeSvg.innerHTML = '';
    return;
  }

  JsBarcode(barcodeSvg, value, {
    format: 'CODE128',
    width: 1.35,
    height: 34,
    displayValue: showText,
    fontSize: 7,
    text: text,
    margin: 0,
    background: '#ffffff',
    lineColor: '#111111',
    textMargin: 2,
  });
}

document.getElementById('generateBtn').addEventListener('click', updateLabel);
document.getElementById('printBtn').addEventListener('click', () => {
  updateLabel();
  window.print();
});

barcodeInput.addEventListener('input', updateLabel);
textInput.addEventListener('input', updateLabel);
mrpInput.addEventListener('input', updateLabel);
showTextInBarcode.addEventListener('change', updateLabel);

updateLabel();
