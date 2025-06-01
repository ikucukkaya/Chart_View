const MAX_LEVELS = 4;                    // 4 dropdown
const SELECTOR_CONTAINER = document.getElementById("selectors");
const VIEWER = document.getElementById("viewer");

let paths = [];                          // ["LTBA/1_APP/...pdf", ...]
let selections = Array(MAX_LEVELS).fill(null);
let selects = [];

// PDF iframe yüklendiğinde çalışacak fonksiyon
VIEWER.addEventListener('load', function() {
  adjustIframeSize();
  
  // PDF yüklendikten sonra ekrana sığdırmayı dene
  setTimeout(fitPdfToScreen, 800);
});

// Ekran boyutu değiştiğinde PDF boyutunu ayarla
window.addEventListener('resize', function() {
  adjustIframeSize();
  setTimeout(fitPdfToScreen, 300);
});

// PDF'i ekrana sığdırmak için ek fonksiyon
function fitPdfToScreen() {
  if (VIEWER.src && window.innerWidth <= 850) {
    try {
      // PDF viewer'ın içine mesaj gönder
      VIEWER.contentWindow.postMessage({ type: 'fit-to-width' }, '*');
      VIEWER.contentWindow.postMessage({ type: 'fit-to-page' }, '*');
    } catch(e) {
      // Cross-origin hataları için sessizce devam et
    }
  }
}

// PDF boyutunu ayarlayan fonksiyon
function adjustIframeSize() {
  if (VIEWER.src) {
    // Mobil cihazlarda özel ayarlar
    if (window.innerWidth <= 850) {
      // Container'ı tam genişlik yap
      const container = VIEWER.parentElement;
      if (container) {
        container.style.width = '100%';
        container.style.maxWidth = '100%';
        container.style.overflow = 'hidden';
        container.style.padding = '0';
      }
      
      // PDF iframe'ini mobil için optimize et
      VIEWER.style.width = '100%';
      VIEWER.style.maxWidth = '100%';
      VIEWER.style.height = `${window.innerHeight - 180}px`;
      VIEWER.style.minHeight = '500px';
      VIEWER.style.border = 'none';
      VIEWER.style.transform = 'scale(0.98)'; // Hafifçe küçült
      VIEWER.style.transformOrigin = 'top center';
      
      // PDF içeriğini ekrana sığdır
      updatePdfUrlForMobile();
      
    } else {
      // Desktop için normal boyutlar
      const container = VIEWER.parentElement;
      if (container) {
        container.style.width = '';
        container.style.marginLeft = '';
        container.style.marginRight = '';
        container.style.overflow = '';
      }
      
      VIEWER.style.width = '100%';
      VIEWER.style.height = '80vh';
      VIEWER.style.border = '1px solid var(--border)';
    }
  }
}

// Mobil için PDF URL'sini güncelle
function updatePdfUrlForMobile() {
  if (VIEWER.src && window.innerWidth <= 850) {
    const currentSrc = VIEWER.src;
    const baseSrc = currentSrc.split('#')[0];
    
    // Mobil için optimize edilmiş parametreler
    const mobileParams = [
      'view=FitV',  // PDF'i dikey olarak ekrana sığdır
      'toolbar=0',
      'navpanes=0',
      'scrollbar=1',
      'zoom=page-fit', // Tam ekrana sığdırmak için değiştirildi
      'pagemode=none'
    ].join('&');
    
    const newSrc = `${baseSrc}#${mobileParams}`;
    
    if (currentSrc !== newSrc) {
      VIEWER.src = newSrc;
      
      // PDF yüklendikten sonra tam ekrana sığdırmasını sağla
      setTimeout(() => {
        try {
          VIEWER.contentWindow.postMessage({ type: 'fit-to-width' }, '*');
        } catch(e) {
          // Cross-origin hatalarını yoksay
        }
      }, 1000);
    }
  }
}

// ---------- Başlat ----------
fetch("pdf_paths.json")
  .then(r => r.json())
  .then(data => {
    paths = data;
    createSelectBoxes();
    populateOptions(0);                  // ilk menü dolu gelsin
  });

// ---------- UI Kur ----------
function createSelectBoxes(){
  for(let lvl=0; lvl<MAX_LEVELS; lvl++){
    const sel = document.createElement("select");
    sel.setAttribute("level", lvl);
    sel.innerHTML = `<option selected disabled>${getLabel(lvl)}</option>`;
    sel.addEventListener("change", handleChange);
    SELECTOR_CONTAINER.appendChild(sel);
    selects.push(sel);
  }
}

// ---------- Etkileşim ----------
function handleChange(e){
  const level = +e.target.getAttribute("level");
  selections[level] = e.target.value;

  // Sonraki seviyeleri resetle
  for(let i=level+1; i<MAX_LEVELS; i++){
    selections[i] = null;
    selects[i].innerHTML = `<option selected disabled>${getLabel(i)}</option>`;
  }

  const maybePath = selections.filter(Boolean).join("/");
  
  // Önce iframe'i temizle
  VIEWER.src = '';
  
  if(paths.includes(maybePath)){
    // PDF yolunu oluştur
    const pdfPath = `Charts/${maybePath}`;
    
    // PDF'in gerçekten mevcut olup olmadığını kontrol et
    checkPdfExists(pdfPath).then(exists => {
      if (exists) {
        loadPdfSafely(pdfPath);
      } else {
        console.error('PDF dosyası bulunamadı:', pdfPath);
        showPdfError('PDF dosyası bulunamadı');
      }
    });
    return;
  }

  if(level+1 < MAX_LEVELS) populateOptions(level+1);
}

// PDF'in varlığını kontrol eden fonksiyon
async function checkPdfExists(pdfPath) {
  try {
    const response = await fetch(pdfPath, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Güvenli PDF yükleme fonksiyonu
function loadPdfSafely(pdfPath) {
  const loadingIndicator = document.getElementById('pdf-loading');
  
  // Loading göster
  if (loadingIndicator) {
    loadingIndicator.style.display = 'block';
  }
  
  // Iframe'i tamamen temizle
  VIEWER.src = 'about:blank';
  
  // Kısa gecikme ile PDF yükle
  setTimeout(() => {
    const isMobile = window.innerWidth <= 850;
    let pdfUrl;
    
    if (isMobile) {
      // Mobil için basit parametreler
      pdfUrl = `${pdfPath}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
    } else {
      // Desktop için standart parametreler
      pdfUrl = `${pdfPath}#toolbar=1&navpanes=0&view=FitH`;
    }
    
    // PDF'i yükle
    VIEWER.src = pdfUrl;
    
    // Yükleme başarı kontrolü
    VIEWER.onload = function() {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      
      // İçeriğin PDF olup olmadığını kontrol et
      setTimeout(() => {
        try {
          const iframeDoc = VIEWER.contentDocument || VIEWER.contentWindow.document;
          // Eğer HTML içerik varsa, bu PDF değildir
          if (iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML.includes('select')) {
            console.error('PDF yükleme hatası: HTML içerik tespit edildi');
            showPdfError('PDF yükleme hatası');
            VIEWER.src = 'about:blank';
          }
        } catch (e) {
          // Cross-origin hataları normal, PDF doğru yüklenmiştir
        }
      }, 1000);
    };
    
    VIEWER.onerror = function() {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      showPdfError('PDF yükleme hatası');
    };
  }, 200);
}

// PDF hata mesajı göster
function showPdfError(message) {
  VIEWER.src = 'about:blank';
  const container = VIEWER.parentElement;
  if (container) {
    // Geçici hata mesajı göster
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 2rem;
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      border-radius: 8px;
      text-align: center;
      z-index: 100;
    `;
    errorDiv.innerHTML = `
      <strong>Hata:</strong><br>
      ${message}<br>
      <small>Lütfen farklı bir chart seçin.</small>
    `;
    
    // Eski hata mesajlarını temizle
    const oldError = container.querySelector('.pdf-error');
    if (oldError) oldError.remove();
    
    errorDiv.className = 'pdf-error';
    container.appendChild(errorDiv);
    
    // 5 saniye sonra hata mesajını kaldır
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }
}

// Tüm PDF yükleme event listener'larını kaldır
VIEWER.removeEventListener('load', adjustIframeSize);
window.removeEventListener('resize', adjustIframeSize);

// Sadece basit resize event listener ekle
window.addEventListener('resize', function() {
  if (VIEWER.src && VIEWER.src !== 'about:blank') {
    const currentPath = VIEWER.src.split('#')[0];
    if (currentPath.includes('Charts/')) {
      setTimeout(() => {
        loadPdfSafely(currentPath);
      }, 300);
    }
  }
});

// Gereksiz fonksiyonları kaldır
// fitPdfToScreen, adjustIframeSize, updatePdfUrlForMobile fonksiyonlarını kaldırın

// PDF iframe yükleme fonksiyonlarını temizle
// loadPdfIntoIframe ve fitPdfToViewport fonksiyonlarını kaldırın
