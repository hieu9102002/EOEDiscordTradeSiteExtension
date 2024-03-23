const cacheTime = 3 * 60 * 60 * 1000
async function fetchData() {
    const cache = await browser.storage.local.get("users")
    if (cache.users && (Date.now() - (new Date(cache.users.lastQueried)).getTime()) < cacheTime)
        return cache.users

    const result = await fetch(
        'https://firestore.googleapis.com/v1/projects/east-oriath-exiles/databases/(default)/documents/:runQuery',
        {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "structuredQuery": {
                    "from": [
                        {
                            "collectionId": "Signups"
                        }
                    ]
                }
            })
        })

    /** @type {{document: {fields: {snowflake: {stringValue: string},discord_username: {stringValue: string}, poe_username: {stringValue: string}}}}[]} */
    const resultLists = await result.json()
    const users = Object.fromEntries(resultLists.map(doc => {
        const poeName = doc.document.fields.poe_username.stringValue;
        const discName = doc.document.fields.discord_username.stringValue;
        const discId = doc.document.fields.snowflake.stringValue;
        return [poeName, [discId, discName]]
    }))
    users.lastQueried = Date.now()
    await browser.storage.local.set({
        users: users
    })
    return users
}


const mapPromise = fetchData()

const resultListObserver = new MutationObserver(async (mutationList) => {
    const map = await mapPromise;
    for (const record of mutationList) {
        /** @type {Element[]} */
        const addedNodes = [...record.addedNodes.entries()]
            .map(([_,node]) => node)
            .filter(node => node?.classList?.length === 1 && node.classList[0] === 'row')
        
        // Row = [Left, Middle, Right]
        // > Middle = [[[Header, Description]]]
        // > Right = [[Price div, Name div, Buttons div]]
        // > > > Name div = [Name, Listed x days ago]
        addedNodes.forEach(node => {
            /** @type {string} */
            const poeName = node.lastElementChild.lastElementChild.children[1]
                            .firstElementChild.textContent;
            if (!map[poeName]) {
                return;
            }
            const itemName = node.children[1].firstElementChild.firstElementChild.firstElementChild.textContent.replace(/\s\s+/g, ' ');
            const [discId, discName] = map[poeName];
            const buttonsDiv = node.lastElementChild.lastElementChild.lastElementChild;
            const spanNode = document.createElement('span');
            const discordButton = document.createElement('button')
            discordButton.textContent = `Discord: ${discName}`
            discordButton.className = 'btn btn-default'
            discordButton.onclick = () => navigator.clipboard.writeText(`<@${discId}> Hi, can I buy your${itemName}`)
            spanNode.appendChild(discordButton)
            buttonsDiv.appendChild(spanNode)
        })
    }
})

const resultObserver = new MutationObserver((mutationList) => {
    for (const record of mutationList) {
        // Check if result set is removed from DOM (usually happens when user searches a new item)
        if ([...record.removedNodes.entries()].some(([_,node]) => node?.className === 'resultset')){
            resultListObserver.disconnect()
            continue;
        }
        const resultSetNode = [...record.addedNodes.entries()].find(([_,node]) => node?.className === 'resultset')?.[1]
        if (resultSetNode) {
            resultListObserver.observe(resultSetNode, {childList: true})
        }
    }
})

function wait() {
    if (document.getElementsByClassName('results').length === 0) {
        setTimeout(wait, 100)
    } else {
        const resultDiv = document.getElementsByClassName('results')[0]
        resultObserver.observe(resultDiv, {childList: true})
    }
}

wait()
