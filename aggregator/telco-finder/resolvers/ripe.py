import os
import ipaddress
import sqlite3
import urllib.request
import gzip
import shutil
import time

from dbutils.pooled_db import PooledDB

DATABASE_FILE = "ripe.db"

def create_connection():
    return sqlite3.connect(DATABASE_FILE)

pool = PooledDB(creator=create_connection, mincached=1, maxcached=5, maxconnections=10)

def resolve(identifier_type, identifier_value):
    try:
        ip = int(ipaddress.ip_address(identifier_value))
        conn = pool.connection()
        cursor = conn.cursor()
        cursor.execute("SELECT org FROM ripe_inetnum WHERE start <= ? AND end >= ?;", (ip, ip))

        row = cursor.fetchone()
        org = row[0] if row else None

        conn.close()

        print(f"Resolved {identifier_value} to {org}")

        return org
    except Exception as e:
        print(f"Error resolving {identifier_value}: {e}")
        return None


def _download_ripe_database(url, ripe_output_file):
    if not os.path.isfile(ripe_output_file + ".gz"):
        print(f"Downloading {url}...")
        urllib.request.urlretrieve(url, ripe_output_file + ".gz")

    if not os.path.isfile(ripe_output_file):
        print(f"Uncompressing {ripe_output_file}.gz...")
        with gzip.open(ripe_output_file + ".gz", 'rb') as f_in, open(ripe_output_file, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)

    print("File downloaded and uncompressed successfully.")


def _populate_local_database(ripe_output_file):
    print(f"Populating database with CIDR ranges. This might take a couple of minutes...")
    start_ip = None
    end_ip = None

    conn = pool.connection()
    cursor = conn.cursor()

    create_table_query = '''
        CREATE TABLE IF NOT EXISTS ripe_inetnum (
            id INTEGER PRIMARY KEY, start INTEGER, end INTEGER, org TEXT
        );
        '''

    cursor.execute(create_table_query)

    cursor.execute("BEGIN TRANSACTION;")

    with open(ripe_output_file, 'r', encoding='latin-1') as f_in:
        for line in f_in:
            line = line.strip()

            if line.startswith('inetnum:'):
                inetnum = line.split(':')[1].strip()

                if inetnum == '0.0.0.0 - 255.255.255.255':
                    continue

                start_ip, end_ip = map(str.strip, inetnum.split('-'))
                start_ip = int(ipaddress.ip_address(start_ip))
                end_ip = int(ipaddress.ip_address(end_ip))

            elif line.startswith('org:'):
                org = line.split(':')[1].strip()
                cursor.execute("INSERT OR IGNORE INTO ripe_inetnum (start, end, org) VALUES (?, ?, ?);", (start_ip, end_ip, org))

            elif not line:
                start_ip = None
                end_ip = None

    cursor.execute("COMMIT;")

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_start ON ripe_inetnum (start);")

    conn.close()
    print(f"Database populated")


# This function loads the RIPE database into a SQLite database.
# The database is not commited to the repo due to licensing restrictions.
RIPE_DB_URL = "https://ftp.ripe.net/ripe/dbase/split/ripe.db.inetnum.gz"
RIPE_DB_OUTPUT_FILE = "ripe.db.inetnum"

print("Loading RIPE database...")
start_time = time.time()
_download_ripe_database(RIPE_DB_URL, RIPE_DB_OUTPUT_FILE)
_populate_local_database(RIPE_DB_OUTPUT_FILE)
elapsed_time = time.time() - start_time
print(f"DONE in {elapsed_time:.2f} seconds.")
