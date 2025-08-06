// Variabel global untuk menyimpan kode yang dihasilkan
let generatedCode = '';
let recipientNameForFile = 'penerima';

// Data spesifik untuk setiap tema
const THEME_DETAILS = {
    ocean: {
        badge: '🌊', main_title: 'Bisikan Samudra Biru', subtitle_template: 'Untuk {recipient_name}, Penjaga Jiwa yang Bijaksana ✨',
        reveal_button: '🫧 Sentuh Keajaiban Samudra 🫧', special_wish_button: '📜 Buka Gulungan Doa dari Hati Samudra 📜', footer_template: '🐚 Dari Hati yang Tulus, {sender_name} 🐚'
    },
    forest: {
        badge: '🌿', main_title: 'Bisikan Hutan Kuno', subtitle_template: 'Untuk {recipient_name}, Penjaga Jiwa yang Bijaksana ✨',
        reveal_button: '🍃 Sentuh Keajaiban Alam 🍃', special_wish_button: '📜 Buka Gulungan Doa dari Hati Hutan 📜', footer_template: '🍂 Dari Hati yang Tulus, {sender_name} 🍂'
    },
    sky_day: {
        badge: '✨', main_title: 'Pesan dari Angkasa', subtitle_template: 'Untuk {recipient_name}, Sang Bintang yang Bersinar Terang 🌟',
        reveal_button: '☁️ Terbangkan Pesan Ini ☁️', special_wish_button: '📜 Buka Gulungan Doa dari Cakrawala 📜', footer_template: '🌌 Dengan Cinta Setinggi Langit, {sender_name} 🌌'
    },
    ghibli_sunset: {
        badge: '🏮', main_title: 'Bisikan Langit Senja', subtitle_template: 'Untuk {recipient_name}, Jiwa Secerah Bintang di Langit Keajaiban ✨',
        reveal_button: '🏮 Nyalakan Lentera Ajaib 🏮', special_wish_button: '📜 Buka Gulungan Doa Langit Malam 📜', footer_template: '✨ Dengan Kekaguman Setulus Cahaya Senja, {sender_name} ✨'
    },
    ghibli_day: {
        badge: '☀️', main_title: 'Pesan Secerah Mentari', subtitle_template: 'Untuk {recipient_name}, Jiwa yang Bersinar di Taman Keajaiban ✨',
        reveal_button: '🏞️ Buka Petualangan Ini 🏞️', special_wish_button: '📜 Buka Gulungan Doa dari Lembah Impian 📜', footer_template: '✨ Dengan Kekaguman Setulus Hati, {sender_name} ✨'
    }
};

// Ambil referensi ke elemen-elemen DOM
const generatorForm = document.getElementById('generator-form');
const outputSection = document.getElementById('output-section');
const htmlOutput = document.getElementById('html-output');
const previewBtn = document.getElementById('preview-btn');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');

// --- EVENT LISTENERS ---

// 1. Tombol "Generate HTML" (Submit Form)
generatorForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData(generatorForm);
    const data = Object.fromEntries(formData.entries());
    recipientNameForFile = data.recipient_name;

    const bday_date = new Date(data.birthday);
    const year = bday_date.getFullYear();
    const month = bday_date.getMonth(); // 0-indexed untuk JS Date
    const day = bday_date.getDate();

    const theme_specifics = THEME_DETAILS[data.theme];

    // Ambil template dan proses
    fetch('template.html')
        .then(response => response.text())
        .then(template => {
            generatedCode = template
                .replace(/\{\{page_title\}\}/g, `Pesan Spesial untuk ${data.recipient_name}`)
                .replace(/\{\{theme\}\}/g, data.theme)
                .replace(/\{\{recipient_name\}\}/g, data.recipient_name)
                .replace(/\{\{sender_name\}\}/g, data.sender_name)
                .replace(/\{\{year\}\}/g, year)
                .replace(/\{\{month\}\}/g, month)
                .replace(/\{\{day\}\}/g, day)
                .replace(/\{\{badge\}\}/g, theme_specifics.badge)
                .replace(/\{\{main_title\}\}/g, theme_specifics.main_title)
                .replace(/\{\{subtitle\}\}/g, theme_specifics.subtitle_template.replace('{recipient_name}', data.recipient_name))
                .replace(/\{\{reveal_button\}\}/g, theme_specifics.reveal_button)
                .replace(/\{\{message1_title\}\}/g, data.message1_title)
                .replace(/\{\{message1_content\}\}/g, data.message1_content.replace(/\n/g, '<br>'))
                .replace(/\{\{message2_content\}\}/g, data.message2_content.replace(/\n/g, '<br>'))
                .replace(/\{\{message3_content\}\}/g, data.message3_content.replace(/\n/g, '<br>'))
                .replace(/\{\{special_wish_button\}\}/g, theme_specifics.special_wish_button)
                .replace(/\{\{special_wish\}\}/g, data.special_wish.replace(/\n/g, '<br>'))
                .replace(/\{\{footer\}\}/g, theme_specifics.footer_template.replace('{sender_name}', data.sender_name));

            // Tampilkan hasil
            htmlOutput.value = generatedCode;
            outputSection.style.display = 'block';
            outputSection.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => console.error('Error fetching template:', error));
});

// 2. Tombol "Preview"
previewBtn.addEventListener('click', () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
});

// 3. Tombol "Salin Kode"
copyBtn.addEventListener('click', () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Tersalin!';
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Gagal menyalin kode: ', err);
    });
});

// 4. Tombol "Unduh File"
downloadBtn.addEventListener('click', () => {
    if (!generatedCode) return;
    const safe_name = recipientNameForFile.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const filename = `ucapan_untuk_${safe_name}.html`;
    
    const blob = new Blob([generatedCode], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
