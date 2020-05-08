const sails = require('sails');
var AWS = require('aws-sdk');
const moment = require('moment');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const {Sequelize, QueryTypes} = require("sequelize");
const roundToTwoDecimal = value => Math.round(value * 100) / 100;
const path = 'mysql://root:password@localhost:3306/digiprex-crm';
// const path = 'mysql://digiprex:LDcF4K0lD0tSTJYwIUmi@digiprexapi.ctky9owxz1tq.ap-south-1.rds.amazonaws.com:3306/digiprexstaging';
const sequelize = new Sequelize(path, { operatorsAliases: 0 });
sequelize.authenticate().then(() => {
    console.log('Connection established successfully.');
  }).catch(err => {
    console.error('Unable to connect to the database:', err);
  });
    const FETCH_ORDER_DETAILS = 'SELECT  o.createdAt,o.id,orderNumber,s.value AS status,o.name,u.phoneNumber,t.value as transaction ,a.city,a.landmark,a.pincode,a.state,a.street,a.house, o.alternatePhoneNumber, '+
    'oi.product,oi.quantity,pp.price AS productPrice,oi.productPrice AS productPriceId,pdis.discount AS productDiscount,oi.productDiscount AS productDiscountId,pgst.gst AS productGST,oi.productGST AS productGSTId, p.name AS medicineName,pd.value, oi.status AS itemStatus, COALESCE(oi.packagedQuantity, oi.quantity, 0) AS packagedQuantity '+ 
    'FROM `order` o LEFT OUTER JOIN user u ON o.user=u.id  LEFT OUTER JOIN address a ON o.address=a.id  LEFT OUTER JOIN orderitem oi ON oi.order = o.id '+
    ' LEFT OUTER JOIN status s ON s.id=o.`status` '+
    ' LEFT OUTER JOIN transaction t ON o.id=t.`order` '+
    ' LEFT OUTER JOIN productprice pp ON pp.id = oi.productPrice ' +
    ' LEFT OUTER JOIN productdiscount pdis ON pdis.id = oi.productDiscount '+
    ' LEFT OUTER JOIN productgst pgst ON pgst.id = oi.productGST '+
    ' LEFT OUTER JOIN product p ON oi.product=p.id  LEFT OUTER JOIN productdescription pd ON p.id= pd.id '+
    'WHERE (o.id = $1 and t.isDeleted = false) AND oi.isDeleted = 0';

async function generateInvoice(orderId) {
    try {
        let attachmentData = await  fetchOrderDetails(orderId); 
        let todaysDate = moment(order.createdAt).format('YYYY/MM/DD');
        let invoiceObj = await getInvoiceObject(attachmentData.phoneNumber, todaysDate, attachmentData.name, attachmentData.house, attachmentData.street, attachmentData.city, attachmentData.pinCode, attachmentData.grandTotal, attachmentData.productList, attachmentData.orderId);
        await createInvoice(invoiceObj);
        // sequelize.close();
    } catch(e){
        throw e;
    }
}
async function createInvoice(invoiceObj){
    let fileName;
    let response;
    var pdfDoc;
    try {
        fileName = 'invoice_' + moment() + '.pdf';
        let documentDefinition = await getDocumentDefinition(invoiceObj);
        pdfDoc = await pdfMake.createPdf(documentDefinition, { tableLayouts: 'lightHorizontalLines'}, null, pdfFonts.pdfMake.vfs );
        await pdfDoc.getBase64(async (result, pages) => {
              let uploadedFile = await uploadFile(fileName, result, invoiceObj.orderId, 'invoice');
              response = "invoice generated";
        });
    }catch(e){
        throw e;
    }
    
    return response;
}

async function uploadFile(fileName, pdfData, orderId, attachableType) {
    let awsAuth = {
        ID :'AKIAQLX3HOBEL6STPXXA',
        SECRET: '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',
        BUCKET_NAME: 'rkcd.in'
    };
    let s3 = new AWS.S3({accessKeyId: awsAuth.ID, secretAccessKey: awsAuth.SECRET});
    pdfData = new Buffer(pdfData,'base64');
    let params = { Bucket: awsAuth.BUCKET_NAME, Key: fileName, Body: pdfData, ContentType: 'application/pdf' };
    let s3FileLink = await s3.upload(params).promise();
    console.log(s3FileLink.Location);
    saveAttachmentToDB(s3FileLink.Location, attachableType, orderId)
    // let attachment:Attachment = new Attachment(s3FileLink.Location, orderId, undefined, attachableType);
    // await AttachmentUtility.saveToDB(attachment);
    // return s3FileLink;
}
async function saveAttachmentToDB(fileLink, attachableType, orderId){
    let result;
    try{
        let Attachment = sequelize.define('attchment', {
            order: {
                type: 'number'
              },
              fileLink:{
                type: 'string',
                required: true,
                allowNull: false
              },
              isDeleted:{
                type: 'boolean',
                required: false,
                allowNull: true
              },
              attachableType:{
                type: 'string',
                required: false,
                allowNull: true
              }
        },
        {freezeTableName: true,
        tableName: 'attachment'}
        );
        result = await Attachment.create({fileLink: fileLink, isDeleted: false, attachableType: 'invoice', order: orderId});
    } catch(e) {
        throw e;
    }
}
async function getDocumentDefinition(invoiceObj) {
    return  {
      content: [
        {
          text: 'INVOICE CUM DELIVERY CHALLAN',
          bold: true,
          fontSize: 13,
          alignment: 'center',
          margin: [0, 0, 0, 10],
        },
        {
          alignment: 'justify',
          style: 'columns',
          columns: [
            [
              {
                text: 'Sandor Medicaids Pvt Ltd.',
                style: 'bill',
              },
              {
                text: 'D.No: 8-2-326/5',
                style: 'smallText',
              },
              {
                text: 'Road No: 3, Banjara Hills',
                style: 'smallText',
              },
              {
                text: 'Hyderabad-500034',
                style: 'smallText',
              },
              {
                text: 'Tel:040-23357048 / 23354824,',
                style: 'smallText',
              },
              {
                text: 'Fax No. 040-23357046,',
                style: 'smallText',
              },
              {
                text: 'Email: info@sandor.co.in',
                style: 'smallText',
              },
              {
                text: 'GSTIN: 36AADCS4168H1Z7',
                style: 'smallText',
              },
              {
                text: 'DL. No: 20/20-B/21/21-B/97/HD1/AP/2010',
                style: 'smallText',
              }
            ],
            {
              width: 50,
              text: '',
            },
            [
              {
                text: 'Bill To : ',
                style: 'bill',
              },
              {
                columns: [
                  [
                    {
                      text: 'Invoice Number',
                      style: 'smallText',
                    },
                    {
                      text: 'Date',
                      style: 'smallText',
                    },
                    {
                      text: 'Patient Name',
                      style: 'smallText',
                    },
                    {
                      text: 'Patient Phone',
                      style: 'smallText',
                    },
                    {
                      text: 'Address',
                      style: 'smallText',
                    },
                  ],
                  [
                    {
                      text: ': SMPL-' + (20000 + invoiceObj.orderId).toString(),
                      style: 'smallText',
                    },
                    {
                      text: ': ' + String(invoiceObj.todaysDate) ,
                      style: 'smallText',
                    },
                    {
                      text: ': ' +  invoiceObj.customerName,
                      style: 'smallText',
                    },
                    {
                      text: ': ' +  invoiceObj.phoneNumber,
                      style: 'smallText',
                    },
                    ...(`${invoiceObj.houseNo ? invoiceObj.houseNo+',' :''} ` + `${invoiceObj.streetAddress ? invoiceObj.streetAddress+',' :''} `).match(/(.{1,24})/g).map(el => {
                      return {
                        text: el,
                        style: 'smallText'
                      }
                    }),
                    {
                      text: invoiceObj.city + ',' + String(invoiceObj.pincode),
                      style: 'smallText',
                    },
                  ],
                ],
              },
            ],
          ],
        },
        await getBillObject(invoiceObj),
        await totalBillObject(invoiceObj),
        await footerLine(),
      ],
      styles: {
        name: {
          fontSize: 12,
          bold: true,
        },
        smallText: {
          fontSize: 10,
        },
        bill: {
          fontSize: 12,
          bold: true,
          margin: [0, 0, 0, 5],
        },
        table: {
          margin: [0, 0, 0, 20],
        },
        columns: {
          margin: [0, 0, 0, 20],
        },
        header: {
          fontSize: 10,
          bold: true,
          margin: [0, 20, 0, 10],
          decoration: 'underline',
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
        },
        cell: {
          fontSize: 8,
        },
        totalBill: {
          fontSize: 10,
        },
        amount: {
          fontSize: 8,
          alignment: 'right',
        },
        AmountHeader: {
          fontSize: 10,
          bold: true,
          alignment: 'right',
        },
        footerTable: {
          margin: [30, 0, 0, 0],
        },
        centerAlign: {
          fontSize: 8,
          alignment: 'center',
        },
        centerHeader: {
          fontSize: 10,
          bold: true,
          alignment: 'center',
        },
      },
    };
}

async function totalBillObject(invoiceObj) {
      return {
        layout: 'noBorders',
        style: 'table',
        table: {
          widths : ['*', '*', '*', '*'],
          body: [
            [{
              text: '',
            },
            {
              text: '',
            },
            {
              text : 'You saved',
              style: 'AmountHeader',
            },
            {
              text: '₹' + invoiceObj.totalDiscount.toFixed(2),
              style: 'amount',
            }],
            [{
              text: '',
            },
            {
              text: '',
            },
            {
              text: 'Round Off',
              style: 'AmountHeader',
            },
            {
              text: ((Math.round(invoiceObj.grandTotal) - ((invoiceObj.grandTotal*100)/100)) < 0 ? '-' : '+') + '₹' + (Math.round(invoiceObj.grandTotal) - ((invoiceObj.grandTotal*100)/100)).toFixed(2),
              style: 'amount',
            },
            ],
            [{
              text: '',
            },
            {
              text: '',
            },
            {
              text: 'Grand Total',
              style: 'AmountHeader',
            },
            {
              text: '₹' + Math.round(invoiceObj.grandTotal).toFixed(2),
              style: 'amount',
            },
            ],
          ],
        },
      };
  }
async function getBillObject(invoiceObj) {
    let orderItemsTable = [];
    let orderItem = invoiceObj.orderItem;
    let total = 0;
    for(let i = 0; i < orderItem.length; i++) {
      let itemPrice = orderItem[i].productPrice;
      let itemQuantity =  orderItem[i].quantity;
      let itemDiscount = orderItem[i].productDiscount;
      let itemGst = orderItem[i].productGST;
      let discount = Math.round((itemPrice*itemQuantity*(itemDiscount)/100)*100)/100;
      let discountedPrice = Math.round((itemPrice*itemQuantity*(100-itemDiscount)/100)*100)/100;
      let finalPrice = discountedPrice;
      invoiceObj['grandTotal']= Math.round((invoiceObj.grandTotal+finalPrice)*100)/100;
      invoiceObj['totalDiscount'] = Math.round((invoiceObj.totalDiscount+discount)*100)/100;
      orderItemsTable.push([
        {text: orderItem[i].name,
          style: 'cell',
      }, {
        text: String(orderItem[i].quantity),
        style: 'centerAlign',
      }, {
        text: '₹' + itemPrice.toFixed(2),
        style: 'amount',
      },{
        text: '₹' + (Math.round(((itemPrice * 100) / (100 + itemGst))*100)/100).toFixed(2),
        style: 'amount',
      },
       {
        text: itemGst,
        style: 'centerAlign',
      },
      {
        text: '₹' + (Math.round((itemPrice * (itemGst / 100))*100)/100).toFixed(2),
        style: 'amount',
      },
    ])
    }
    return {
      layout: 'noBorders',
      style: 'table',
      table: {
        widths: ['*', 50, '*', '*', 50, '*'],
        body: [
          [{
            text: 'MedicineName',
            style: 'tableHeader',
          },
          {
            text: 'Qty.',
            style: 'centerHeader',
          },
          {
            text: 'MRP',
            style: 'AmountHeader',
          },
          {
            text: 'Unit Chargeable Price',
            style: 'AmountHeader',
          },
          {
            text: 'GST(%)',
            style: 'centerHeader',
          },
          {
            text: 'Unit GST',
            style: 'AmountHeader',
          },
          ],
          ...orderItemsTable
        ],
      },
    };
  }
  async function footerLine() {
    return {
        style: 'footerTable',
        table: {
        widths : ['auto'],
        body: [
            [{
            text: 'For Discounts on Medicines, Diagnostics and Surgeries call us on 040-48217091',
            alignment: 'center',
            },
            ],
        ],
        },
    };
  }

async function getInvoiceObject(phoneNumber, todaysDate, customerName, houseNo, streetAddress, city, pincode, amount, orderItem, orderId) {
    let data = {
        'phoneNumber': phoneNumber,
        'todaysDate': todaysDate,
        'customerName': customerName,
        'houseNo': houseNo,
        'streetAddress': streetAddress,
        'city': city,
        'pincode': pincode,
        'amount': amount,
        'orderItem': orderItem,
        'orderId': orderId,
        'grandTotal': 0,
        'totalDiscount': 0,
    };
    return data;
}
const Status = sequelize.define('status', {
    type: {
        type: 'string',
        required: false,
        allowNull: true
      },
      value: {
        type: 'string',
        required: false,
        allowNull: true
      },
    },
    {
        freezeTableName: true,
        tableName: 'status'
    }
);
async function getStatusValue(type, statusId) {
    let result;
    try{
        result = await Status.findByPk(statusId);
        result = result.dataValues;
    }catch(e){
        throw e;
    }
    return result;
}

async function getOrder(orderId) {
    let result;
    try {
        let Order = sequelize.define('order', {
            orderNumber: {
                type: 'number',
                required: true,
                allowNull: false
              },
              user: {
               type: 'number',
              },
              address:{
                type: 'number',
              },
              status:{
                type: 'number',
              },
              transaction:{
                type: 'number',
              },
              name:{
                type: 'string',
                required: true,
                allowNull: false
              },
              createdBy:{
                type: 'number',
              },
              alternatePhoneNumber: {
                type: 'string',
                required: false,
                allowNull: true
              }
        },
        {freezeTableName: true,
        tableName: 'order'}
        );
        result = await Order.findByPk(orderId);
        result = result.dataValues;
    } catch(e) {
        throw e;
    }
    return result;
}

async function fetchOrderDetails(orderId) {
    let orderDetails; 
    let resultObj = {};
    try{
        orderDetails = await sequelize.query(FETCH_ORDER_DETAILS,
            {
                bind: [orderId],
                type: QueryTypes.SELECT
            }
        );
      if(orderDetails){
        resultObj={
          createdAt:orderDetails[0].createdAt,
          orderId:orderDetails[0].id,
          orderNumber:orderDetails[0].orderNumber,
          status:orderDetails[0].status,
          name:orderDetails[0].name ,
          phoneNumber:orderDetails[0].phoneNumber, 
          transaction:orderDetails[0].transaction,
          city:orderDetails[0].city,
          house:orderDetails[0].house,
          pinCode:orderDetails[0].pincode,
          landmark:orderDetails[0].landmark,
          street:orderDetails[0].street,
          state:orderDetails[0].state,
          alternatePhoneNumber: orderDetails[0].alternatePhoneNumber,
           
        }
      }    
      order = await getOrder(orderId);
      let orderStatus = await getStatusValue('order', order.status);
      let productList = [];
      let grandTotalAmount = 0;
      if(orderDetails.length){
        for(let item of orderDetails){
          let totalAmount = 0;
          let totalAmountWithDiscount = 0;
          let totalAmountWithGST = 0;
          let itemStatusValue = await getStatusValue('orderItem', item.itemStatus)
          if(itemStatusValue !== 'cancelled' && orderStatus !== 'cancelled' ) {
            totalAmount = parseInt(item.quantity)*item.productPrice;
            totalAmountWithDiscount = totalAmount-(totalAmount*(item.productDiscount/100));
            totalAmountWithGST = totalAmountWithDiscount +(totalAmountWithDiscount*(item.productGST/100));
            grandTotalAmount = grandTotalAmount + totalAmountWithDiscount;
            productList.push({"product":item.product,"name":item.medicineName,"quantity":item.quantity,
            "dose":item.value,"productPrice": roundToTwoDecimal(item.productPrice),
            "productPriceId":item.productPriceId,"productDiscountId":item.productDiscountId,
            "productDiscount":roundToTwoDecimal(item.productDiscount),"productGST":roundToTwoDecimal(item.productGST),"productGSTId":item.productGSTId,
            "totalAmount":roundToTwoDecimal(totalAmount),"totalAmountWithDiscount":roundToTwoDecimal(totalAmountWithDiscount),"totalAmountWithGST":roundToTwoDecimal(totalAmountWithGST)});
          }
          //TODO: Fix cancelled scenarios
          else if(orderStatus === 'cancelled') {
            totalAmount = parseInt(item.quantity)*item.productPrice;
            totalAmountWithDiscount = totalAmount-(totalAmount*(item.productDiscount/100));
            totalAmountWithGST = totalAmountWithDiscount +(totalAmountWithDiscount*(item.productGST/100));
            grandTotalAmount = grandTotalAmount + totalAmountWithDiscount;
            productList.push({"product":item.product,"name":item.medicineName,"quantity":item.quantity,
            "dose":item.value,"productPrice":roundToTwoDecimal(item.productPrice),"productPriceId":item.productPriceId,
            "productDiscountId":item.productDiscountId,"productDiscount":roundToTwoDecimal(item.productDiscount),
            "productGST":roundToTwoDecimal(item.productGST),"productGSTId":item.productGSTId,"totalAmount":roundToTwoDecimal(totalAmount),
            "totalAmountWithDiscount":roundToTwoDecimal(totalAmountWithDiscount),"totalAmountWithGST":roundToTwoDecimal(totalAmountWithGST)});
          }
        }
        resultObj["productList"] = productList;
        resultObj["grandTotal"] = roundToTwoDecimal(grandTotalAmount);
      }else{
        resultObj["productList"] = productList;
      }
    }catch(e){
      throw e;
    }
    return resultObj;
  }
  generateInvoice(256);