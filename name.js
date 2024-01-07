async function fetchData() {
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

    /** @type {{document: {fields: {discord_username: {stringValue: string}, poe_username: {stringValue: string}}}}[]} */
    const resultLists = await result.json()
    return Object.fromEntries(resultLists.map(doc => {
        const poeName = doc.document.fields.poe_username.stringValue;
        const discName = doc.document.fields.discord_username.stringValue;
        return [poeName, discName]
    }))
}


fetchData().then(map => {
    const resultListObserver = new MutationObserver((mutationList) => {
        for (const record of mutationList) {
            /** @type {Element[]} */
            const addedNodes = [...record.addedNodes.entries()]
                .map(([_,node]) => node)
                .filter(node => node?.classList.length === 1 && node.classList[0] === 'row')
            
            // Row = [Left, Middle, Right]
            // > Right = [[Price div, Name div, Buttons div]]
            // > > > Name div = [Name, Listed x days ago]
            addedNodes.forEach(node => {
                const poeName = node.lastElementChild.lastElementChild.children[1]
                                .firstElementChild.textContent;
                const discName = map[poeName];
                const buttonsDiv = node.lastElementChild.lastElementChild.lastElementChild;
                const spanNode = document.createElement('span');
                const discordButton = document.createElement('button')
                discordButton.textContent = `Discord: ${discName}` ?? 'No discord names found'
                discordButton.className = 'btn btn-default'
                discordButton.onclick = () => navigator.clipboard.writeText(`@${discName}`)
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
})
