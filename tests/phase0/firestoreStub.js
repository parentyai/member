'use strict';

function getValueByPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function createDbStub() {
  const state = { collections: {}, autoId: 0 };

  function ensureCollection(name) {
    if (!state.collections[name]) {
      state.collections[name] = { docs: {} };
    }
    return state.collections[name];
  }

  function createDocRef(collection, id) {
    return {
      id,
      async set(data, options) {
        collection.docs[id] = { data: Object.assign({}, data), options: options || null };
      },
      async get() {
        const doc = collection.docs[id];
        return {
          id,
          exists: Boolean(doc),
          data: () => (doc ? Object.assign({}, doc.data) : undefined)
        };
      }
    };
  }

  function createQuery(collection, filters, orderBy, limitCount) {
    return {
      where(field, op, value) {
        return createQuery(collection, filters.concat({ field, op, value }), orderBy, limitCount);
      },
      orderBy(field, direction) {
        return createQuery(collection, filters, { field, direction }, limitCount);
      },
      limit(n) {
        return createQuery(collection, filters, orderBy, n);
      },
      async get() {
        let docs = Object.entries(collection.docs).map(([id, doc]) => ({
          id,
          data: () => Object.assign({}, doc.data)
        }));
        if (filters.length) {
          docs = docs.filter((doc) => {
            const data = doc.data();
            return filters.every((f) => {
              if (f.op !== '==') return true;
              return getValueByPath(data, f.field) === f.value;
            });
          });
        }
        if (orderBy) {
          const dir = orderBy.direction === 'asc' ? 1 : -1;
          docs.sort((a, b) => {
            const av = getValueByPath(a.data(), orderBy.field);
            const bv = getValueByPath(b.data(), orderBy.field);
            if (av === bv) return 0;
            if (av === undefined) return 1;
            if (bv === undefined) return -1;
            return av > bv ? dir : -dir;
          });
        }
        if (typeof limitCount === 'number') {
          docs = docs.slice(0, limitCount);
        }
        return { docs };
      }
    };
  }

  return {
    __isStub: true,
    _state: state,
    collection(name) {
      const collection = ensureCollection(name);
      return {
        doc(id) {
          const docId = id || `auto_${++state.autoId}`;
          return createDocRef(collection, docId);
        },
        where(field, op, value) {
          return createQuery(collection, [{ field, op, value }], null, null);
        },
        orderBy(field, direction) {
          return createQuery(collection, [], { field, direction }, null);
        },
        limit(n) {
          return createQuery(collection, [], null, n);
        },
        async get() {
          return createQuery(collection, [], null, null).get();
        }
      };
    }
  };
}

module.exports = {
  createDbStub
};
