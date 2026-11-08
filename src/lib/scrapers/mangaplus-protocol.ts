import { parse } from "protobufjs";

// Minimal read-only subset of the public website's wire schema, inspected at
// https://mangaplus.shueisha.co.jp/js/app.a6d19ac9.js (2026-11-08).
// Unknown fields, including reader images and paid-access data, are skipped.
export const mangaPlusResponseType = parse(`
    syntax = "proto3";
    message Response {
        Success success = 1;
        Error error = 2;
    }
    message Success {
        TitleDetail titleDetailView = 8;
        Viewer mangaViewer = 10;
        AllTitles allTitlesViewV2 = 25;
    }
    message Error {
        Popup englishPopup = 2;
        repeated Popup popups = 5;
    }
    message Popup {
        string subject = 1;
        string body = 2;
    }
    message AllTitles { repeated TitleGroup allTitlesGroup = 1; }
    message TitleGroup { repeated Title titles = 2; }
    enum Language {
        ENGLISH = 0;
        SPANISH = 1;
        FRENCH = 2;
        INDONESIAN = 3;
        PORTUGUESE_BR = 4;
        RUSSIAN = 5;
        THAI = 6;
        GERMAN = 7;
        ITALIAN = 8;
        VIETNAMESE = 9;
    }
    message Title {
        uint32 titleId = 1;
        string name = 2;
        string author = 3;
        string portraitImageUrl = 4;
        Language language = 7;
    }
    message Chapter {
        uint32 titleId = 1;
        uint32 chapterId = 2;
        string name = 3;
        string subTitle = 4;
        uint32 startTimeStamp = 6;
    }
    message ChapterGroup {
        repeated Chapter firstChapterList = 2;
        repeated Chapter midChapterList = 3;
        repeated Chapter lastChapterList = 4;
    }
    message TitleDetail {
        Title title = 1;
        string overview = 3;
        repeated Chapter firstChapterList = 9;
        repeated Chapter lastChapterList = 10;
        repeated ChapterGroup chapterListGroup = 28;
    }
    message Viewer {
        uint32 chapterId = 2;
        repeated Chapter chapters = 3;
    }
`).root.lookupType("Response");

export function decodeMangaPlusResponse(bytes: Uint8Array) {
    const message = mangaPlusResponseType.decode(bytes);
    return mangaPlusResponseType.toObject(message, { enums: String });
}
