import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://jvsjzlvabtffhsnvmcto.supabase.co';
const supabaseKey = 'sb_publishable_H2EPwvAaziQVz8T4yExdEw_bQrB5f3V';
const supabase = createClient(supabaseUrl, supabaseKey);

// UI Interaction Logic
const bookCover = document.querySelector('.book-cover');
const bottomSheet = document.querySelector('.bottom-sheet');
const sheetHandle = document.querySelector('.sheet-handle');

// Slide the sheet up when a book is tapped
bookCover.addEventListener('click', () => {
  bottomSheet.classList.add('open');
});

// Slide the sheet down when the handle is tapped
sheetHandle.addEventListener('click', () => {
  bottomSheet.classList.remove('open');
});
