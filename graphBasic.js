

class Graph {
   let nodes = []

   addNode(node) {
     this.nodes.push(node)
   }

   printGraph () {
       for (let i=0;i<this.nodes.length;i++) {
               console.log("Node: "+this.nodes[i].val)
               for (let j=0;i<this.nodes[j].children.length;j++) {
                    console.log("......child: "+this.nodes[i].children[j])
              }
       }
   } //printGraph

}

class Node {
    constructor (val, children) {
         this.val = val
         this.children = children
    }




} //Node



//========= runtime ==========
let nodeSource = [
   [1,3],
   [null],
   [0]
   [4,1]
   [5]
   [1]
]

let myGraph = new Graph()

for (let i=0;i<this.nodeSource.length;i++) {
         let newNode = new Node (i,nodeSource[i])
         myGraph.addNode(newNode)

}

myGraph.printGraph()
