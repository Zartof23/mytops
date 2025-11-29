**mytops**
==========

**mytops** is a platform that lets people keep track of their favorite things and share them with the world — all powered by **gen-db-ai** and **n8n**.

What makes **mytops** different is its ability to **create and grow its own database on demand**. Instead of relying on a fully pre-populated database, mytops generates entries dynamically based on user requests.

⭐️ Overview
===========
------------
Traditional apps rely on pre-populated databases.**mytops flips the model: the database builds itself on demand.**

Users can:

*   Create their own topics

*   Search for any item

*   Rate and save their favorites

*   Share their personal “tops” publicly


When an item isn’t found, AI automatically fetches it from the web, extracts structured data, and adds it to the global database — validated by the user.

This creates a living, evolving, community-shaped information graph.

🧠 How It Works
===============
------------
### **1\. Create or Select a Topic**

Topics are flexible and user-defined:

*   Movies

*   Books

*   Albums

*   Anime

*   Cars

*   Restaurants

*   ANYTHING you want to track


### **2\. Search for an Item**

*   **If it exists:** You see its details instantly.

*   **If it does not exist:** The AI enrichment workflow begins.


### **3\. AI-Generated Imports**

Using **gen-db-ai** + **n8n**, the system:

1.  Searches online sources

2.  Scrapes structured metadata

3.  Suggests the best match

4.  Lets the user confirm

5.  Imports the item into the global database


### **4\. Rate & Save**

Users assign a star rating and add items to their personal lists.


🔌 Tech Stack
=============
------------

*   **gen-db-ai** — AI-based database generator & enrichment engine

*   **n8n** — workflow automation for scraping, data cleanup, and processing

*   **Frontend/Backend** — (add details when ready)

🧭 Roadmap
==========
------------
### **MVP**

*   Create & manage topics

*   Search & browse items

*   AI enrichment for missing data

*   Star rating system

*   User profiles & personal lists


### **Phase 2**

*   Public sharable “Top” pages

*   Social sharing & discovery

*   Trending lists

*   Tags and multi-category support


### **Phase 3**

*   Recommendation engine

*   Multi-source AI enrichment

*   Topic collaboration

*   Public API access

🎯 Why mytops?
==================
------------------

*   Users can track their favorite things effortlessly

*   Topics are unlimited and user-defined

*   Database grows organically with community usage

*   AI ensures high-quality data imports

*   Perfect for discovery, sharing tastes, and ranking everything


📜 License
==================
------------------

This project uses the **MIT License**, allowing reuse, modification, and commercial usage — as long as proper attribution is given.