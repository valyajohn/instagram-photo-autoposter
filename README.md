# Автопостинг видео (Reels) и фото (фотосессии) из Google Диска в Instagram

Автоматическая публикация видеофайлов (`.mp4`) и фотографий (`.jpg`, `.png`) из Google Диска в Instagram с интервалом **1 час** через GitHub Actions.

## Как это работает
- **Reels (`.github/workflows/autopost.yml`)**: каждый час (`0 * * * *`) берёт новое видео, очищает имя от `.mp4`, добавляет 8 случайных тегов и первый комментарий.
- **Фото (`.github/workflows/autopost-photos.yml`)**: каждый час (`30 * * * *`) берёт новое фото из папки `GDRIVE_PHOTOS_FOLDER_ID`, подбирает случайное название из 60 заголовков фотосессий и 10 случайных хештегов популярных образов, затем оставляет первый комментарий.

## Настройка секретов GitHub (Settings → Secrets and variables → Actions)

| Секрет | Обязательно | Описание |
| --- | --- | --- |
| `GDRIVE_FOLDER_ID` | Для видео | ID папки Google Диска с видео |
| `GDRIVE_PHOTOS_FOLDER_ID` | Для фото | ID папки Google Диска с фото (открыта по ссылке) |
| `GOOGLE_API_KEY` | Да | API-ключ из Google Cloud Console (включён Google Drive API) |
| `IG_USER_ID` | Да | ID вашего Instagram Business/Creator аккаунта |
| `IG_ACCESS_TOKEN` | Да | Токен Meta Graph API |

## Важно: права на запись для GitHub Actions
Перейдите в **Settings → Actions → General → Workflow permissions** и выберите **Read and write permissions**, чтобы workflow мог обновлять `posted_videos.json` и `posted_photos.json`.
