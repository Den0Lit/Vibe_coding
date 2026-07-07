package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type DocType string

const (
	TestCase  DocType = "testcase"
	Checklist DocType = "checklist"
)

type Document struct {
	ID        int       `json:"id"`
	Type      DocType   `json:"type"`
	Title     string    `json:"title"`
	Steps     string    `json:"steps"`
	Expected  string    `json:"expected"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

var db *sql.DB

func main() {
	var err error
	db, err = sql.Open("sqlite", "./qa_repository.db")
	if err != nil {
		fmt.Printf("Ошибка подключения к БД: %v\n", err)
		return
	}
	defer db.Close()

	initTableQuery := `
	CREATE TABLE IF NOT EXISTS documents (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT NOT NULL,
		title TEXT NOT NULL,
		steps TEXT,
		expected TEXT,
		status TEXT NOT NULL,
		created_at DATETIME NOT NULL
	);`
	if _, err = db.Exec(initTableQuery); err != nil {
		fmt.Printf("Ошибка инициализации таблицы: %v\n", err)
		return
	}

	// Главная страница
	http.HandleFunc("/", handleIndex)
	
	// ЯВНЫЕ МАРШРУТЫ ДЛЯ СТИЛЕЙ И СКРИПТОВ (Решают проблему чёрно-белого экрана)
	http.HandleFunc("/style.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css")
		http.ServeFile(w, r, "./style.css")
	})
	http.HandleFunc("/script.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		http.ServeFile(w, r, "./script.js")
	})

	// API эндпоинты
	http.HandleFunc("/api/documents", handleDocuments)
	http.HandleFunc("/api/documents/", handleSingleDocument)

	fmt.Println("Сервер запущен на http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Printf("Ошибка запуска сервера: %v\n", err)
	}
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	// Если пришёл запрос на несуществующий файл, не отдаём index.html
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	tmpl, err := template.ParseFiles("index.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tmpl.Execute(w, nil)
}

func handleDocuments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query("SELECT id, type, title, steps, expected, status, created_at FROM documents ORDER BY id ASC")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var docs []Document = []Document{}
		for rows.Next() {
			var doc Document
			var createdAtStr string
			rows.Scan(&doc.ID, &doc.Type, &doc.Title, &doc.Steps, &doc.Expected, &doc.Status, &createdAtStr)
			doc.CreatedAt, _ = time.Parse("2006-01-02T15:04:05Z", createdAtStr)
			if doc.CreatedAt.IsZero() {
				doc.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
			}
			docs = append(docs, doc)
		}
		json.NewEncoder(w).Encode(docs)

	case http.MethodPost:
		var doc Document
		json.NewDecoder(r.Body).Decode(&doc)
		if doc.Status == "" {
			doc.Status = "untested"
		}
		now := time.Now().UTC()
		result, _ := db.Exec("INSERT INTO documents (type, title, steps, expected, status, created_at) VALUES (?, ?, ?, ?, ?, ?)", doc.Type, doc.Title, doc.Steps, doc.Expected, doc.Status, now)
		lastID, _ := result.LastInsertId()
		doc.ID = int(lastID)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(doc)
	}
}

func handleSingleDocument(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Неверный ID", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(parts[3])
	if err != nil {
		http.Error(w, "Неверный формат ID", http.StatusBadRequest)
		return
	}

	if r.Method == http.MethodDelete {
		_, err = db.Exec("DELETE FROM documents WHERE id = ?", id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success":true}`))
		return
	}

	if r.Method == http.MethodPut {
		var updatedDoc Document
		json.NewDecoder(r.Body).Decode(&updatedDoc)
		db.Exec("UPDATE documents SET title = ?, steps = ?, expected = ?, status = ? WHERE id = ?", updatedDoc.Title, updatedDoc.Steps, updatedDoc.Expected, updatedDoc.Status, id)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(updatedDoc)
		return
	}

	http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
}
