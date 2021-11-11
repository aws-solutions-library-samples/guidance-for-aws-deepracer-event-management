

import React, { Component } from 'react';
import { Storage, API } from 'aws-amplify';
import { Image as ImageSR, Table, Button } from 'semantic-ui-react';
import ReactJson from 'react-json-view';
import Boundingbox from 'react-bounding-box';

const path = require('path')
class Images extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      percent: 0,
      result: '',
      filename: '',
      files: [],
      view: 'list',
      boundingBoxParams: [],
      boundingOptions: {},
      primaryLabel: ""
    };
  }

  componentDidMount = async () => {
    async function getImages() { 
      const apiName = 'images';
      const apiPath = 'images';
  
      return await API.get(apiName, apiPath)//, myInit);
    }

    this._isMounted = true;
    
    // view
    if (this.state.view === 'itemview'){

    }
    else {
      // Collect Image data
      this.setState({ files: [] })
      let images = await getImages();
      //console.log(images);
      let enhancedArrayedResult = [];
      images.forEach(element => {
        let thumbnailKey = path.relative('/public', element.thumbnailKey);
        let presignedurl = Storage.get(thumbnailKey)
        presignedurl.then(url => {
          element.presignedurl = url
          enhancedArrayedResult = this.state.files
          enhancedArrayedResult.push(element)
          this.setState({ files: enhancedArrayedResult })
          //console.log(element)
        })
      })
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  onDeleteClickHandler = async(clickitem, i, event) => {
    async function deleteImage(user,timestampId) { 
      const apiName = 'images';
      const apiPath = 'images/';
      const myInit = { 
        body: {
          timestampId: timestampId,
          user: user
        }
      };
  
      return await API.del(apiName, apiPath, myInit);
    }

    console.log(clickitem['user'])
    console.log(clickitem['timestamp#id'])

    let response = await deleteImage(clickitem['user'],clickitem['timestamp#id'])
    console.log(response)

    this.componentDidMount()
  }

  imageOpenOnClickHandler = async(clickitem) => {
    var img = new Image();

    let options = {
      colors: {
        normal: 'rgba(255,225,255,1)',
        selected: 'rgba(0,225,204,1)',
        unselected: 'rgba(100,100,100,1)'
      },
      style: {
        maxWidth: '100%',
        maxHeight: '90vh'
      }
      //showLabels: false
    }

    //console.log(clickitem)
    //this.setState({ item: clickitem })
    this.setState({ view: 'itemview' })
    
    //console.log(clickitem.fullsizeKey);
    let key = path.relative('/public', clickitem.fullsizeKey);
    //console.log(key);
    let presignedurl = Storage.get(key)
    presignedurl.then(url => {
      //console.log(url);
      this.setState({ presignedurl: url })
      img.src = url;
    })
    let labels = JSON.parse(clickitem.labels)

    if (labels.length > 0){
      if ('Name' in labels[0]){
        let primaryLabel = labels[0].Name
        this.setState({ primaryLabel: primaryLabel })
        console.log("primary label: " + primaryLabel)
      }
    }
    this.setState({ labels: labels })
    

    this.setState({ boundingOptions: options })

    // // Bounding Boxes
    // let width = clickitem.fullsizeWidth
    // let height = clickitem.fullsizeHeight
    // let boundingBoxes = []
    // labels.forEach(label => {
    //   label['Instances'].forEach(Instance => {
    //     //[x, y, width, height]
    //     let coord=[Instance['BoundingBox']['Left']*width,Instance['BoundingBox']['Top']*height,Instance['BoundingBox']['Width']*width,Instance['BoundingBox']['Height']*height]
    //     boundingBoxes.push(coord)
    //   })
    // })
    // this.setState({ boundingBoxes: boundingBoxes })
  }

  imageCloseOnClickHandler = async() => {
    //console.log(clickitem)
    this.setState({ view: 'list' })
  }
  //
  render() {
    var tablerows = this.state.files.map(function (item, i) {
      return <Table.Row key={i} >
        <Table.Cell><Button onClick={(event) => this.imageOpenOnClickHandler(item)}>{path.relative('/public', item.fullsizeKey)}</Button></Table.Cell>
        <Table.Cell><ImageSR src={item.presignedurl} size='medium' /> </Table.Cell>
        <Table.Cell><Button negative circular icon='delete' onClick={(event) => this.onDeleteClickHandler(item, i, event)}/></Table.Cell>
      </Table.Row>
    }.bind(this));

    let content = ''
    if (this.state.view === 'itemview'){
      content = <Table celled striped>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Image</Table.HeaderCell>
          <Table.HeaderCell>Data</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row key={0} verticalAlign='top' >
          <Table.Cell><Boundingbox image={this.state.presignedurl} boxes={this.state.boundingBoxes} options={this.state.boundingOptions} /> </Table.Cell>
          <Table.Cell><ReactJson src={this.state.labels} displayDataTypes={false} displayObjectSize={false} enableClipboard={false} /></Table.Cell>
        </Table.Row>
        <Table.Row key={1} >
          <Button onClick={(event) => this.imageCloseOnClickHandler()}>Back</Button>
          <Button href={'https://collection.sciencemuseumgroup.org.uk/objects/' + this.state.primaryLabel + '/'} as='a'>{this.state.primaryLabel}</Button>
        </Table.Row>
      </Table.Body>
    </Table>
    

      //<ImageSR src={this.state.presignedurl} size='large' />
    } else {
      content = <Table celled striped>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell>Image</Table.HeaderCell>
          <Table.HeaderCell>Delete</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {tablerows}
      </Table.Body>
    </Table>
    }


    return (
      <div>
      {content}
    </div>
    )
  }
}

export {Images}